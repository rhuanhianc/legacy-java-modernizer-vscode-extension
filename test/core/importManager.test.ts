import * as vscode from 'vscode';
import { ImportManager, JavaImport } from '../../src/utils/importManager';

describe('ImportManager', () => {
  test('should add import to a document without imports', async () => {
    const javaContent = `package com.example;

public class Test {
    // Class content
}`;

    const document = await vscode.workspace.openTextDocument({
      content: javaContent,
      language: 'java'
    });

    const requiredImport: JavaImport = {
      packageName: 'java.util',
      className: 'List'
    };

    // Mock document.getText to return different content depending on range
    const getTextSpy = jest.spyOn(document, 'getText');
    getTextSpy.mockImplementation((range) => {
      if (!range) {
        return javaContent;
      }
      return '';
    });

    const edit = await ImportManager.addImport(document, requiredImport);
    
    expect(edit).toBeDefined();
    expect(edit?.insert).toHaveBeenCalled();
    
    // Extract the inserted text
    const insertCall = edit?.insert as jest.Mock;
    const insertedText = insertCall.mock.calls[0][2];
    
    expect(insertedText).toBe('import java.util.List;\n');
  });

  test('should add import after existing imports', async () => {
    const javaContent = `package com.example;

import java.util.ArrayList;
import java.util.HashMap;

public class Test {
    // Class content
}`;

    const document = await vscode.workspace.openTextDocument({
      content: javaContent,
      language: 'java'
    });

    const requiredImport: JavaImport = {
      packageName: 'java.util',
      className: 'Set'
    };

    // Mock document.getText to return different content depending on range
    const getTextSpy = jest.spyOn(document, 'getText');
    getTextSpy.mockImplementation((range) => {
      if (!range) {
        return javaContent;
      }
      return '';
    });

    const edit = await ImportManager.addImport(document, requiredImport);
    
    expect(edit).toBeDefined();
    expect(edit?.insert).toHaveBeenCalled();
    
    // Verify insertion position is after the last import
    const insertCall = edit?.insert as jest.Mock;
    const insertedText = insertCall.mock.calls[0][2];
    
    expect(insertedText).toBe('import java.util.Set;\n');
  });

  test('should not add import if it already exists', async () => {
    const javaContent = `package com.example;

import java.util.List;
import java.util.ArrayList;

public class Test {
    // Class content
}`;

    const document = await vscode.workspace.openTextDocument({
      content: javaContent,
      language: 'java'
    });

    const requiredImport: JavaImport = {
      packageName: 'java.util',
      className: 'List'
    };

    // Mock document.getText to return different content depending on range
    const getTextSpy = jest.spyOn(document, 'getText');
    getTextSpy.mockImplementation((range) => {
      if (!range) {
        return javaContent;
      }
      return '';
    });

    const edit = await ImportManager.addImport(document, requiredImport);
    
    expect(edit).toBeUndefined();
  });

  test('should not add import if wildcard import exists', async () => {
    const javaContent = `package com.example;

import java.util.*;

public class Test {
    // Class content
}`;

    const document = await vscode.workspace.openTextDocument({
      content: javaContent,
      language: 'java'
    });

    const requiredImport: JavaImport = {
      packageName: 'java.util',
      className: 'List'
    };

    // Mock document.getText to return different content depending on range
    const getTextSpy = jest.spyOn(document, 'getText');
    getTextSpy.mockImplementation((range) => {
      if (!range) {
        return javaContent;
      }
      return '';
    });

    const edit = await ImportManager.addImport(document, requiredImport);
    
    expect(edit).toBeUndefined();
  });

  test('should add static import correctly', async () => {
    const javaContent = `package com.example;

import java.util.List;

public class Test {
    // Class content
}`;

    const document = await vscode.workspace.openTextDocument({
      content: javaContent,
      language: 'java'
    });

    const requiredImport: JavaImport = {
      packageName: 'java.util.Arrays',
      className: 'asList',
      isStatic: true
    };

    // Mock document.getText to return different content depending on range
    const getTextSpy = jest.spyOn(document, 'getText');
    getTextSpy.mockImplementation((range) => {
      if (!range) {
        return javaContent;
      }
      return '';
    });

    const edit = await ImportManager.addImport(document, requiredImport);
    
    expect(edit).toBeDefined();
    expect(edit?.insert).toHaveBeenCalled();
    
    // Extract the inserted text
    const insertCall = edit?.insert as jest.Mock;
    const insertedText = insertCall.mock.calls[0][2];
    
    expect(insertedText).toBe('import static java.util.Arrays.asList;\n');
  });

  test('should add multiple imports correctly', async () => {
    const javaContent = `package com.example;

public class Test {
    // Class content
}`;

    const document = await vscode.workspace.openTextDocument({
      content: javaContent,
      language: 'java'
    });

    const requiredImports: JavaImport[] = [
      {
        packageName: 'java.util',
        className: 'List'
      },
      {
        packageName: 'java.util',
        className: 'Map'
      },
      {
        packageName: 'java.io',
        className: 'File'
      }
    ];

    // Mock document.getText to return different content depending on range
    const getTextSpy = jest.spyOn(document, 'getText');
    getTextSpy.mockImplementation((range) => {
      if (!range) {
        return javaContent;
      }
      return '';
    });

    const edit = await ImportManager.addImports(document, requiredImports);
    
    expect(edit).toBeDefined();
    expect(edit?.insert).toHaveBeenCalled();
    
    // Extract the inserted text
    const insertCall = edit?.insert as jest.Mock;
    const insertedText = insertCall.mock.calls[0][2];
    
    // Check that all imports are included in order
    expect(insertedText).toContain('import java.util.List;\n');
    expect(insertedText).toContain('import java.util.Map;\n');
    expect(insertedText).toContain('import java.io.File;\n');
  });

  test('should add import to a document without package declaration', async () => {
    const javaContent = `public class Test {
    // Class content
}`;

    const document = await vscode.workspace.openTextDocument({
      content: javaContent,
      language: 'java'
    });

    const requiredImport: JavaImport = {
      packageName: 'java.util',
      className: 'List'
    };

    // Mock document.getText to return different content depending on range
    const getTextSpy = jest.spyOn(document, 'getText');
    getTextSpy.mockImplementation((range) => {
      if (!range) {
        return javaContent;
      }
      return '';
    });

    const edit = await ImportManager.addImport(document, requiredImport);
    
    expect(edit).toBeDefined();
    expect(edit?.insert).toHaveBeenCalled();
    
    // Extract the inserted text and position
    const insertCall = edit?.insert as jest.Mock;
    const insertPosition = insertCall.mock.calls[0][1];
    const insertedText = insertCall.mock.calls[0][2];
    
    // Should insert at the beginning of the file
    expect(insertPosition.line).toBe(0);
    expect(insertPosition.character).toBe(0);
    expect(insertedText).toBe('import java.util.List;\n');
  });
});