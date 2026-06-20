import fs from 'fs';
import path from 'path';
import { createEditTool } from '../tools/edit';

/**
 * Test for multi-line editing specifically
 */

const TEST_DIR = path.join(__dirname, 'temp-multiline-test');

function setupTestDir() {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
}

function cleanupTestDir() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

function createTestFile(filename: string, content: string) {
  const filePath = path.join(TEST_DIR, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
}

function readTestFile(filename: string): string {
  const filePath = path.join(TEST_DIR, filename);
  return fs.readFileSync(filePath, 'utf-8');
}

async function runTests() {
  console.log('🧪 Multi-Line Edit Tool Tests...\n');
  let passed = 0;
  let failed = 0;

  setupTestDir();
  const editTool = createEditTool(TEST_DIR);

  // Test 1: Replace multi-line function
  console.log('Test 1: Replace multi-line function');
  try {
    createTestFile('test1.ts', `function add(a: number, b: number): number {
  return a + b;
}

function multiply(a: number, b: number): number {
  return a * b;
}`);
    const result = await editTool.invoke({
      filePath: 'test1.ts',
      edits: [
        {
          oldStr: `function add(a: number, b: number): number {
  return a + b;
}`,
          newStr: `function add(a: number, b: number): number {
  // Add two numbers
  return a + b;
}`,
        },
      ],
    });
    const content = readTestFile('test1.ts');
    if (content.includes('// Add two numbers') && result.includes('Successfully applied')) {
      console.log('✅ PASS: Multi-line function replacement works\n');
      passed++;
    } else {
      console.log(`❌ FAIL: Expected comment in function\nGot:\n${content}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error}\n`);
    failed++;
  }

  // Test 2: Replace object literal (multi-line)
  console.log('Test 2: Replace multi-line object literal');
  try {
    createTestFile('test2.ts', `const config = {
  host: 'localhost',
  port: 3000,
  debug: false
};`);
    const result = await editTool.invoke({
      filePath: 'test2.ts',
      edits: [
        {
          oldStr: `  host: 'localhost',
  port: 3000,
  debug: false`,
          newStr: `  host: 'localhost',
  port: 8080,
  debug: true`,
        },
      ],
    });
    const content = readTestFile('test2.ts');
    if (content.includes('port: 8080') && content.includes('debug: true')) {
      console.log('✅ PASS: Multi-line object property replacement works\n');
      passed++;
    } else {
      console.log(`❌ FAIL: Expected updated config\nGot:\n${content}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error}\n`);
    failed++;
  }

  // Test 3: Replace block of imports
  console.log('Test 3: Replace multi-line imports');
  try {
    createTestFile('test3.ts', `import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from './api';`);
    const result = await editTool.invoke({
      filePath: 'test3.ts',
      edits: [
        {
          oldStr: `import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';`,
          newStr: `import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';`,
        },
      ],
    });
    const content = readTestFile('test3.ts');
    if (content.includes('React,') && content.includes('useCallback')) {
      console.log('✅ PASS: Multi-line import block replacement works\n');
      passed++;
    } else {
      console.log(`❌ FAIL: Expected updated imports\nGot:\n${content}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error}\n`);
    failed++;
  }

  // Test 4: Complex nested structure
  console.log('Test 4: Replace complex nested structure');
  try {
    createTestFile('test4.ts', `class User {
  constructor(name: string) {
    this.name = name;
  }

  getName(): string {
    return this.name;
  }
}`);
    const result = await editTool.invoke({
      filePath: 'test4.ts',
      edits: [
        {
          oldStr: `  constructor(name: string) {
    this.name = name;
  }

  getName(): string {
    return this.name;
  }`,
          newStr: `  constructor(name: string, email: string) {
    this.name = name;
    this.email = email;
  }

  getName(): string {
    return this.name;
  }

  getEmail(): string {
    return this.email;
  }`,
        },
      ],
    });
    const content = readTestFile('test4.ts');
    if (content.includes('email: string') && content.includes('getEmail()')) {
      console.log('✅ PASS: Complex nested structure replacement works\n');
      passed++;
    } else {
      console.log(`❌ FAIL: Expected updated class\nGot:\n${content}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error}\n`);
    failed++;
  }

  // Test 5: Sequential multi-line edits
  console.log('Test 5: Sequential multi-line edits on same file');
  try {
    createTestFile('test5.ts', `const x = 1;
const y = 2;
const z = 3;

function test() {
  console.log('hello');
}`);
    const result = await editTool.invoke({
      filePath: 'test5.ts',
      edits: [
        {
          oldStr: `const x = 1;
const y = 2;
const z = 3;`,
          newStr: `const x = 10;
const y = 20;
const z = 30;`,
        },
        {
          oldStr: `function test() {
  console.log('hello');
}`,
          newStr: `function test() {
  console.log('hello world');
  return true;
}`,
        },
      ],
    });
    const content = readTestFile('test5.ts');
    if (content.includes('x = 10') && content.includes("'hello world'") && result.includes('applied 2 edit')) {
      console.log('✅ PASS: Sequential multi-line edits work\n');
      passed++;
    } else {
      console.log(`❌ FAIL: Expected both edits applied\nGot:\n${content}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error}\n`);
    failed++;
  }

  cleanupTestDir();

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Multi-Line Edit Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  return failed === 0;
}

runTests().then((success) => {
  process.exit(success ? 0 : 1);
});
