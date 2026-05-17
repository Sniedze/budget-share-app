import { gql } from '@apollo/client';

export const FX_RATE = gql`
  query FxRate($from: String!, $to: String!) {
    fxRate(from: $from, to: $to)
  }
`;
