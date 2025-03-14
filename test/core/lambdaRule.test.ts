// test/lambdaRule.test.ts
import * as vscode from 'vscode';
import { LambdaRule } from '../../src/modernization/versions/java8/lambdaRule';

describe('LambdaRule', () => {
  const lambdaRule = new LambdaRule();

  async function testModernization(input: string, expected: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument({
      content: input,
      language: 'java'
    });

    const ranges = await lambdaRule.analyzeDocument(document);
    expect(ranges.length).toBeGreaterThan(0);

    const modernizedText = lambdaRule.getModernizedText(document, ranges[0]);
    expect(modernizedText).toBe(expected);
  }

  test('should detect and convert Runnable anonymous class to lambda', async () => {
    const input = `Runnable r = new Runnable() {
  @Override
  public void run() {
    System.out.println("Hello");
  }
};`;
    const expected = `Runnable r = () -> System.out.println("Hello");`;
    
    await testModernization(input, expected);
  });

  test('should detect and convert Comparator anonymous class to lambda', async () => {
    const input = `Comparator<String> comp = new Comparator<String>() {
  @Override
  public int compare(String s1, String s2) {
    return s1.length() - s2.length();
  }
};`;
    const expected = `Comparator<String> comp = (s1, s2) -> s1.length() - s2.length();`;
    
    await testModernization(input, expected);
  });

  test('should detect and convert Consumer anonymous class to lambda', async () => {
    const input = `Consumer<String> consumer = new Consumer<String>() {
  @Override
  public void accept(String s) {
    System.out.println(s);
  }
};`;
    const expected = `Consumer<String> consumer = s -> System.out.println(s);`;
    
    await testModernization(input, expected);
  });

  test('should preserve the block body when multiple statements exist', async () => {
    const input = `Runnable r = new Runnable() {
  @Override
  public void run() {
    String message = "Hello";
    System.out.println(message);
  }
};`;
    const expected = `Runnable r = () -> {
  String message = "Hello";
  System.out.println(message);
}`;
    
    await testModernization(input, expected);
  });

  test('should properly format parameters with types', async () => {
    const input = `BiFunction<Integer, String, Boolean> func = new BiFunction<Integer, String, Boolean>() {
  @Override
  public Boolean apply(Integer i, String s) {
    return i.toString().equals(s);
  }
};`;
    const expected = `BiFunction<Integer, String, Boolean> func = (i, s) -> i.toString().equals(s);`;
    
    await testModernization(input, expected);
  });

  test('should not match non-functional interfaces', async () => {
    const input = `Object obj = new Object() {
  @Override
  public String toString() {
    return "Custom Object";
  }
};`;
    
    const document = await vscode.workspace.openTextDocument({
      content: input,
      language: 'java'
    });

    const ranges = await lambdaRule.analyzeDocument(document);
    expect(ranges.length).toBe(0);
  });

  test('should handle comments correctly', async () => {
    const input = `Runnable r = new Runnable() {
  @Override
  public void run() {
    // Comment before code
    System.out.println("Hello");
    /* Block comment */
  }
};`;
    const expected = `Runnable r = () -> System.out.println("Hello");`;
    
    await testModernization(input, expected);
  });

  test('should identify if code can be modernized', () => {
    expect(lambdaRule.canModernize({} as vscode.TextDocument, `Runnable r = new Runnable() {
      @Override
      public void run() {
        System.out.println("Hello");
      }
    };`)).toBe(true);
    
    expect(lambdaRule.canModernize({} as vscode.TextDocument, 'String s = "Hello";')).toBe(false);
  });
});