// import commonjs from 'rollup-plugin-commonjs';
// import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: '../lib/TurtleParser.js',
  output: {
    file: 'build/TurtleParser-bundle.js',
    format: 'cjs'
  },
  plugins: [
    // commonjs before bultins      
    commonjs(), // import commonjs from 'rollup-plugin-commonjs';
    nodeResolve(),// builtins(), //  import builtins from 'rollup-plugin-node-builtins';
  ]
};
