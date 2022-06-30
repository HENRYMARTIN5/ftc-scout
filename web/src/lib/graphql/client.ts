import { HttpLink, InMemoryCache, ApolloClient } from "@apollo/client/core";
import { IS_DEV, SERVER_ORIGIN } from "../constants";

const link = new HttpLink({
    uri: SERVER_ORIGIN,
});

const cache = new InMemoryCache({
    possibleTypes: {
        MatchScores: ["MatchScores2021Remote", "MatchScores2021Traditional"],
    },
    typePolicies: {
        Team: { keyFields: ["number"] },
        Event: { keyFields: ["season", "code"] },
        Match: { keyFields: ["season", "eventCode", "id"] },
        // MatchScores2021Traditional: {
        //     keyFields: ["season", "eventCode", "matchId"],
        // },
        // MatchScores2021TraditionalAlliance: {
        //     keyFields: ["season", "eventCode", "matchId", "alliance"],
        // },
        // MatchScores2021Remote: {
        //     keyFields: ["season", "eventCode", "matchId"],
        // },
        TeamMatchParticipation: {
            keyFields: ["season", "eventCode", "matchId", "teamNumber"],
        },
        TeamEventParticipation: {
            keyFields: ["season", "eventCode", "teamNumber"],
        },
    },
});

export const apolloClient = new ApolloClient({
    connectToDevTools: IS_DEV,
    link,
    cache,
});
