/**
 * invocation: e.g. `DEBUG=true TESTS='\(\(\)\)<p>\(\(\)\).' ./node_modules/.bin/jest __tests__/TurtleParser-test.js`
 */

const {TurtleJisonParser, TurtleJisonLexer} = require('../lib/TurtleJison');

DEBUG = process.env.DEBUG;
TESTS = process.env.TESTS;

describe('TurtleJison', () => {
  describe('TurtleJisonParser', () => {
    it('should construct with no params', () => {
      expect(() => {new TurtleJisonParser()}).not.toThrow();
    });
  });
  describe('TurtleJisonLexer', () => {
    it('should construct with no params', () => {
      expect(() => {new TurtleJisonLexer()}).not.toThrow();
    });
  });
});

