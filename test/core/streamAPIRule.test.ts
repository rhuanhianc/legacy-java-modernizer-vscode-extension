// test/streamAPIRule.test.ts
import * as vscode from 'vscode';
import { StreamAPIRule } from '../../src/modernization/versions/java8/streamAPIRule';

describe('StreamAPIRule', () => {
  const streamApiRule = new StreamAPIRule();

  async function testModernization(input: string, expected: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument({
      content: input,
      language: 'java'
    });

    const ranges = await streamApiRule.analyzeDocument(document);
    expect(ranges.length).toBeGreaterThan(0);

    const modernizedText = streamApiRule.getModernizedText(document, ranges[0]);
    expect(modernizedText).toBe(expected);
  }

  test('should convert simple for-each to forEach', async () => {
    const input = `for (String s : strings) {
    System.out.println(s);
}`;
    const expected = `strings.stream()
  .forEach(System.out::println);`;
    
    await testModernization(input, expected);
  });

  test('should convert for-each with filtering to filter and forEach', async () => {
    const input = `for (String s : strings) {
    if (s.length() > 5) {
        System.out.println(s);
    }
}`;
    const expected = `strings.stream()
  .filter(s -> s.length() > 5)
  .forEach(System.out::println);`;
    
    await testModernization(input, expected);
  });

  test('should convert for-each with transformation to map and forEach', async () => {
    const input = `for (String s : strings) {
    String upper = s.toUpperCase();
    System.out.println(upper);
}`;
    const expected = `strings.stream()
  .map(String::toUpperCase)
  .forEach(System.out::println);`;
    
    await testModernization(input, expected);
  });

  test('should convert for-each with result collection to collect', async () => {
    const input = `for (String s : strings) {
    result.add(s);
}`;
    const expected = `// Importe: import java.util.stream.Collectors;
strings.stream()
  .collect(Collectors.toList());`;
    
    await testModernization(input, expected);
  });

  test('should convert filter and collect operations together', async () => {
    const input = `for (String s : strings) {
    if (s.length() > 10) {
        result.add(s);
    }
}`;
    const expected = `// Importe: import java.util.stream.Collectors;
strings.stream()
  .filter(s -> s.length() > 10)
  .collect(Collectors.toList());`;
    
    await testModernization(input, expected);
  });

  test('should convert filter, transform and collect operations together', async () => {
    const input = `for (String s : strings) {
    if (s.length() > 10) {
        result.add(s.toUpperCase());
    }
}`;
    const expected = `// Importe: import java.util.stream.Collectors;
strings.stream()
  .filter(s -> s.length() > 10)
  .map(s -> s.toUpperCase())
  .collect(Collectors.toList());`;
    
    await testModernization(input, expected);
  });

  test('should identify if code can be modernized', () => {
    expect(streamApiRule.canModernize({} as vscode.TextDocument, `for (String s : strings) {
      System.out.println(s);
    }`)).toBe(true);
    
    expect(streamApiRule.canModernize({} as vscode.TextDocument, 'String s = "Hello";')).toBe(false);
  });

  test('should not match for-loops or while-loops', async () => {
    const forLoop = `for (int i = 0; i < 10; i++) {
      System.out.println(i);
    }`;
    
    const whileLoop = `while (condition) {
      System.out.println("Loop");
    }`;
    
    const forDocument = await vscode.workspace.openTextDocument({
      content: forLoop,
      language: 'java'
    });

    const whileDocument = await vscode.workspace.openTextDocument({
      content: whileLoop,
      language: 'java'
    });

    const forRanges = await streamApiRule.analyzeDocument(forDocument);
    const whileRanges = await streamApiRule.analyzeDocument(whileDocument);
    
    expect(forRanges.length).toBe(0);
    expect(whileRanges.length).toBe(0);
  });
});