import { describe, expect, it } from 'vitest';
import { isJsonContentType } from './_lib/contentType.js';

describe('isJsonContentType', () => {
  it.each([
    'application/json',
    'Application/JSON',
    'application/json; charset=utf-8',
    ' application/json ; charset=UTF-8',
  ])('accepts the JSON media type: %s', (value) => {
    expect(isJsonContentType(value)).toBe(true);
  });

  it.each([
    undefined,
    null,
    ['application/json'],
    'text/application/json',
    'application/jsonp',
    'application/problem+json',
  ])('rejects a non-JSON request media type: %s', (value) => {
    expect(isJsonContentType(value)).toBe(false);
  });
});
