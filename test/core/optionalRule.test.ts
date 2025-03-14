import * as vscode from 'vscode';
import { OptionalRule } from '../../src/modernization/versions/java8/optionalRule';
import { ImportManager } from '../../src/utils/importManager';

// Mock ImportManager
jest.mock('../../src/utils/importManager', () => {
  return {
    ImportManager: {
      addImport: jest.fn().mockResolvedValue({
        insert: jest.fn(),
        size: 1,
        entries: jest.fn().mockReturnValue([
          [
            'dummy-uri',
            [
              {
                newText: 'import java.util.Optional;\n',
                range: { start: new vscode.Position(3, 0) }
              }
            ]
          ]
        ])
      }),
      addImports: jest.fn().mockResolvedValue({
        insert: jest.fn(),
        size: 1,
        entries: jest.fn().mockReturnValue([
          [
            'dummy-uri',
            [
              {
                newText: 'import java.util.Optional;\n',
                range: { start: new vscode.Position(3, 0) }
              }
            ]
          ]
        ])
      })
    },
    JavaImport: class {}
  };
});

describe('OptionalRule', () => {
  let optionalRule: OptionalRule;

  beforeEach(() => {
    optionalRule = new OptionalRule();
    // Reset mocks
    jest.clearAllMocks();
  });

  async function testModernization(input: string, expected: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument({
      content: input,
      language: 'java'
    });

    const ranges = await optionalRule.analyzeDocument(document);
    expect(ranges.length).toBeGreaterThan(0);

    const modernizedText = optionalRule.getModernizedText(document, ranges[0]);
    
    // Remove whitespace for easier comparison
    const normalizedExpected = expected.replace(/\s+/g, ' ').trim();
    const normalizedModernized = modernizedText.replace(/\s+/g, ' ').trim();
    
    expect(normalizedModernized).toBe(normalizedExpected);
    
    // Verify that the import was added
    expect(ImportManager.addImport).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        packageName: 'java.util',
        className: 'Optional'
      })
    );
  }

  test('should convert simple null check to Optional with import', async () => {
    const input = `if (user != null) {
      System.out.println(user.getName());
    }`;
    const expected = `Optional.ofNullable(user)
      .ifPresent(user -> System.out.println(user.getName()));`;
    
    await testModernization(input, expected);
  });

  test('should convert null check with method call to Optional', async () => {
    const input = `if (user != null) {
      user.doSomething();
    }`;
    const expected = `Optional.ofNullable(user)
      .ifPresent(user -> user.doSomething());`;
    
    await testModernization(input, expected);
  });

  test('should convert null check with else to ifPresentOrElse', async () => {
    const input = `if (user != null) {
      System.out.println(user.getName());
    } else {
      System.out.println("No user found");
    }`;
    const expected = `Optional.ofNullable(user)
      .ifPresentOrElse(
        user -> {
          System.out.println(user.getName());
        },
        () -> {
          System.out.println("No user found");
        }
      );`;
    
    await testModernization(input, expected);
  });

  test('should convert null check with return to Optional map/orElse', async () => {
    const input = `if (user != null) {
      return user.getName();
    } else {
      return "unknown";
    }`;
    const expected = `Optional.ofNullable(user)
      .map(user -> user.getName())
      .orElse("unknown");`;
    
    await testModernization(input, expected);
  });

  test('should convert complex null check body with multiple lines', async () => {
    const input = `if (user != null) {
      String name = user.getName();
      System.out.println("User: " + name);
      user.logAccess();
    }`;
    const expected = `Optional.ofNullable(user)
      .ifPresent(user -> {
        String name = user.getName();
        System.out.println("User: " + name);
        user.logAccess();
      });`;
    
    await testModernization(input, expected);
  });

  test('should not match complex conditions with &&', async () => {
    const input = `if (user != null && user.isActive()) {
      System.out.println(user.getName());
    }`;
    
    const document = await vscode.workspace.openTextDocument({
      content: input,
      language: 'java'
    });

    const ranges = await optionalRule.analyzeDocument(document);
    expect(ranges.length).toBe(0);
  });

  test('should handle variable declarations in if body', async () => {
    const input = `if (value != null) {
      int length = value.length();
      System.out.println("Length: " + length);
    }`;
    const expected = `Optional.ofNullable(value)
      .ifPresent(value -> {
        int length = value.length();
        System.out.println("Length: " + length);
      });`;
    
    await testModernization(input, expected);
  });

  test('should correctly add import via ImportManager', async () => {
    const document = await vscode.workspace.openTextDocument({
      content: `package com.example;

public class Test {
  public void method() {
    String value = getValue();
    if (value != null) {
      System.out.println(value.length());
    }
  }
}`,
      language: 'java'
    });

    // Call the prepare modernization method
    await optionalRule.prepareModernization(document);

    // Verify the import was added correctly
    expect(ImportManager.addImport).toHaveBeenCalledWith(
      document,
      expect.objectContaining({
        packageName: 'java.util',
        className: 'Optional'
      })
    );
    
    // Verify the workspace edit was applied
    expect(vscode.workspace.applyEdit).toHaveBeenCalled();
  });
});