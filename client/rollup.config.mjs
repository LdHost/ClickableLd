import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [
  {
    input: '../lib/TurtleParser.js',
    output: { file: 'build/TurtleParser-bundle.js', format: 'cjs' },
    plugins: [
      commonjs(),
      nodeResolve(),
    ]
  },{
    input: 'rdf-data-factory',
    output: { file: 'build/rdf-data-factory-bundle.js', format: 'cjs' },
    plugins: [
      commonjs(),
      nodeResolve(),
    ]
  },
  {
    input: '@widgetjs/tree',
    output: { file: 'build/widgetjs-tree-bundle.js', format: 'cjs' },
    plugins: [
      commonjs(),
      nodeResolve(),
    ]
  }
];
