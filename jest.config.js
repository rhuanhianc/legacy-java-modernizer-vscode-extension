/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/', '<rootDir>/test/'],
  testMatch: ['**/test/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/test/**',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  // Configuração corrigida para módulos VS Code
  moduleNameMapper: {
    '^vscode$': '<rootDir>/__mocks__/vscode.ts'
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  verbose: true
};