import {
    GraphQLBoolean,
    GraphQLFieldResolver,
    GraphQLInt,
    GraphQLList,
    GraphQLNonNull,
    GraphQLNullableType,
    GraphQLResolveInfo,
    GraphQLString,
    GraphQLType,
} from "graphql";
import { GQLContext } from "./context";
import DataLoader from "dataloader";
import { GraphQLDateTime } from "graphql-scalars";
import { Brackets } from "typeorm";
import { AnyObject } from "../type-utils";

type Wr<T> = { type: T };
function wr<T>(t: T): Wr<T> {
    return { type: t };
}

export function nn<T extends GraphQLNullableType>(ty: T): GraphQLNonNull<T> {
    return new GraphQLNonNull(ty) as GraphQLNonNull<T>;
}
export function list<T extends GraphQLType>(ty: T): GraphQLNonNull<GraphQLList<T>> {
    return nn(new GraphQLList(ty) as GraphQLList<T>);
}

export const IntTy = wr(nn(GraphQLInt));
export const StrTy = wr(nn(GraphQLString));
export const BoolTy = wr(nn(GraphQLBoolean));
export const DateTy = wr(nn(GraphQLDateTime));

export function listTy<T extends GraphQLType>(ty: Wr<T>): Wr<GraphQLNonNull<GraphQLList<T>>> {
    return wr(list(ty.type));
}

export function nullTy<T extends GraphQLNullableType>(ty: Wr<GraphQLNonNull<T>>) {
    return wr(ty.type.ofType);
}

export function dataLoaderResolver<Source, Result, Key, Args = {}, LookupResult = Result>(
    argsToKey: (s: Source, a: Args) => Key,
    keysToResults: (k: Key[], i: GraphQLResolveInfo[]) => Promise<LookupResult[]>,
    groupResults: (k: Key[], r: LookupResult[]) => Result[]
): GraphQLFieldResolver<Source, GQLContext, Args, Promise<Result>> {
    let dl = new DataLoader<[Key, GraphQLResolveInfo], Result>(
        async (kAndI) => {
            let keys = kAndI.map((k) => k[0]);
            let info = kAndI.map((k) => k[1]);
            let results = await keysToResults(keys, info);
            let groups = groupResults(keys, results);
            return groups;
        },
        { cache: false }
    );

    return async (source: Source, args: Args, _ctx: GQLContext, info: GraphQLResolveInfo) => {
        let key = argsToKey(source, args);
        let res = await dl.load([key, info]);
        return res;
    };
}

function matchByKeys<K, R>(k: K, r: R): boolean {
    if (k == null || typeof k != "object" || typeof r != "object")
        throw "Can only use matchByKey with objects";

    for (let key of Object.keys(k)) {
        if ((k as any)[key] != (r as any)[key]) return false;
    }

    return true;
}

export function dataLoaderResolverSingle<
    Source,
    Result,
    Key,
    Args = {},
    LookupResult extends Result = NonNullable<Result>
>(
    argsToKey: (s: Source, a: Args) => Key,
    keysToResults: (k: Key[], i: GraphQLResolveInfo[]) => Promise<LookupResult[]>,
    keyMatchesResult: (k: Key, r: LookupResult) => boolean = matchByKeys
): GraphQLFieldResolver<Source, GQLContext, Args, Promise<Result>> {
    return dataLoaderResolver(argsToKey, keysToResults, (keys, results) =>
        keys.map((k) => results.find((r) => keyMatchesResult(k, r)) ?? (null as LookupResult))
    );
}

export function dataLoaderResolverList<Source, LookupResult, Key, Args = {}>(
    argsToKey: (s: Source, a: Args) => Key,
    keysToResults: (k: Key[], i: GraphQLResolveInfo[]) => Promise<LookupResult[]>,
    keyMatchesResult: (k: Key, r: LookupResult) => boolean = matchByKeys
): GraphQLFieldResolver<Source, GQLContext, Args, Promise<LookupResult[]>> {
    return dataLoaderResolver(argsToKey, keysToResults, (keys, results) =>
        keys.map((k) => results.filter((r) => keyMatchesResult(k, r)))
    );
}

export function keyListToWhereClause<T extends AnyObject>(tableName: string, keys: T[]): Brackets {
    let vIdx = 0;

    return new Brackets((qb) => {
        for (let key of keys) {
            let thisKey = new Brackets((subQb) => {
                for (let [k, v] of Object.entries(key)) {
                    subQb.andWhere(`${tableName}.${k} = :v${vIdx}`, { [`v${vIdx}`]: v });
                    vIdx += 1;
                }
            });
            qb.orWhere(thisKey);
        }
    });
}
