import { ParserResponse, StreamParser } from '../parsing/parser';

interface StateRoot {
  type: 'Root';
}

interface StateHead {
  type: 'Head';
}

interface StateHeadChoices {
  type: 'HeadChoices';
}

export type ParserState = {};

export const dinnikParser: StreamParser<ParserState, null> = {
  startState: { type: 'Root' },
  advance: (stream, state): ParserResponse<ParserState, null> => {},
  handleEof: (state): ParserResponse<ParserState, null> | null => {
    return null;
  },
};
