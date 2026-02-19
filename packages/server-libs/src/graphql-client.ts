import { GraphQLClient } from 'graphql-request';

export function createGraphQLClient(endpoint: string, token?: string): GraphQLClient {
  return new GraphQLClient(endpoint, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}
