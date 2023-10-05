/**
 * invocation: e.g. `DEBUG=true TESTS='\(\(\)\)<p>\(\(\)\).' ./node_modules/.bin/jest __tests__/TurtleParser-test.js`
 */

const {TurtleJisonContext, origText} = require('../lib/TurtleJisonContext');

const stringEscapeReplacements = { '\\': '\\', "'": "'", '"': '"',
                                   't': '\t', 'b': '\b', 'n': '\n', 'r': '\r', 'f': '\f' },

DEBUG = process.env.DEBUG;
TESTS = process.env.TESTS;

describe('TurtleParser', () => {
  describe('construction', () => {
    it('should construct with no params', () => {
      expect(() => {new TurtleJisonContext(null)}).not.toThrow();
    });
  });

  describe('unescaping', () => {
    it('should unescape a good sequence', () => {
      const ctx = new TurtleJisonContext(null);
      expect(ctx.unescapeText('\\\\\\\'\\"\\n', stringEscapeReplacements)).toEqual('\\\'"\n');
    });

    it('should unescape outside BMP', () => {debugger
      const ctx = new TurtleJisonContext(null);
      expect(ctx.unescapeText('\\U0001D49E', stringEscapeReplacements)).toEqual('𝒞');
    });

    it('should throw on bad escape sequence', () => {
      const ctx = new TurtleJisonContext(null);
      expect(() => {ctx.unescapeText('\\q', stringEscapeReplacements)}).toThrow("no replacement found for 'q'");
    });
  });
});

