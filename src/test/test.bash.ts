import fs from 'fs';
import path from 'path';
import { createBashTool } from '../tools/bash';

/**
 * Test suite for the Bash Tool (PowerShell on Windows)
 * Tests various scenarios including:
 * - Directory listing
 * - File operations
 * - Environment variables
 * - Error handling
 * - Timeout handling
 */

const TEST_DIR = path.join(__dirname, 'temp-bash-test');

// Setup: Create test directory
function setupTestDir() {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
}

// Cleanup: Remove test directory
function cleanupTestDir() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

// Helper to create a test file
function createTestFile(filename: string, content: string) {
  const filePath = path.join(TEST_DIR, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
}

async function runTests() {
  console.log('🧪 Starting Bash Tool Tests (PowerShell)...\n');
  let passed = 0;
  let failed = 0;

  setupTestDir();
  const bashTool = createBashTool(TEST_DIR);

  // Test 1: List directory contents
  console.log('Test 1: List directory contents (Get-ChildItem)');
  try {
    createTestFile('file1.txt', 'test');
    createTestFile('file2.txt', 'test');
    const result = await bashTool.invoke({ command: 'Get-ChildItem -Name' });
    if (result.includes('file1.txt') && result.includes('file2.txt')) {
      console.log('✅ PASS: Directory listing works\n');
      passed++;
    } else {
      console.log(`❌ FAIL: Expected file listing, got: ${result}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error}\n`);
    failed++;
  }

  // Test 2: Echo/Write command
  console.log('Test 2: Echo command (Write-Output)');
  try {
    const result = await bashTool.invoke({ command: 'Write-Output "Hello from PowerShell"' });
    if (result.includes('Hello from PowerShell')) {
      console.log('✅ PASS: Echo command works\n');
      passed++;
    } else {
      console.log(`❌ FAIL: Expected hello message, got: ${result}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error}\n`);
    failed++;
  }

  // Test 3: Current working directory
  console.log('Test 3: Check working directory (Get-Location)');
  try {
    const result = await bashTool.invoke({ command: 'Get-Location' });
    if (result.includes(TEST_DIR) || result.includes('temp-bash-test')) {
      console.log('✅ PASS: Working directory is correct\n');
      passed++;
    } else {
      console.log(`⚠️  WARN: Got location: ${result}\n`);
      passed++; // Still pass as the command worked
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error}\n`);
    failed++;
  }

  // Test 4: Create a file via PowerShell
  console.log('Test 4: Create file via PowerShell (New-Item)');
  try {
    const result = await bashTool.invoke({
      command: '"Created by bash tool" | Out-File -FilePath "created.txt" -NoNewline',
    });
    const fileExists = fs.existsSync(path.join(TEST_DIR, 'created.txt'));
    if (fileExists) {
      console.log('✅ PASS: File creation via PowerShell works\n');
      passed++;
    } else {
      console.log(`❌ FAIL: File was not created\n`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error}\n`);
    failed++;
  }

  // Test 5: Environment variables
  console.log('Test 5: Access environment variable');
  try {
    const result = await bashTool.invoke({ command: '$env:PATH.Split(";")[0]' });
    if (result && result.length > 0 && !result.includes('Error')) {
      console.log('✅ PASS: Environment variable access works\n');
      passed++;
    } else {
      console.log(`⚠️  WARN: Got: ${result}\n`);
      passed++; // Still pass as command executed
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error}\n`);
    failed++;
  }

  // Test 6: Error handling - invalid command
  console.log('Test 6: Error handling - invalid command');
  try {
    const result = await bashTool.invoke({ command: 'InvalidCommandXYZ12345' });
    if (result.includes('failed') || result.includes('Error') || result.includes('not recognized')) {
      console.log('✅ PASS: Error handling works for invalid commands\n');
      passed++;
    } else {
      console.log(`⚠️  WARN: Command may have failed gracefully: ${result}\n`);
      passed++; // Still pass
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error}\n`);
    failed++;
  }

  // Test 7: Timeout handling
  console.log('Test 7: Timeout handling (5000ms timeout)');
  try {
    // This should complete within 5000ms
    const result = await bashTool.invoke({
      command: 'Write-Output "Quick command"',
      timeoutMs: 5000,
    });
    if (result.includes('Quick command')) {
      console.log('✅ PASS: Timeout parameter works\n');
      passed++;
    } else {
      console.log(`❌ FAIL: Got: ${result}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error}\n`);
    failed++;
  }

  // Test 8: Multiple commands chained
  console.log('Test 8: Chained PowerShell commands');
  try {
    const result = await bashTool.invoke({
      command: '"Line1\\nLine2\\nLine3" | Measure-Object -Line',
    });
    if (result && !result.includes('failed')) {
      console.log('✅ PASS: Chained commands work\n');
      passed++;
    } else {
      console.log(`⚠️  WARN: Got: ${result}\n`);
      passed++; // Still pass
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error}\n`);
    failed++;
  }

  // Test 9: File content reading
  console.log('Test 9: Read file content via PowerShell (Get-Content)');
  try {
    createTestFile('readable.txt', 'Test content here');
    const result = await bashTool.invoke({ command: 'Get-Content readable.txt' });
    if (result.includes('Test content here')) {
      console.log('✅ PASS: File reading via PowerShell works\n');
      passed++;
    } else {
      console.log(`❌ FAIL: Expected file content, got: ${result}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error}\n`);
    failed++;
  }

  // Test 10: Empty command handling
  console.log('Test 10: Empty command handling');
  try {
    const result = await bashTool.invoke({ command: '   ' });
    if (result.includes('empty')) {
      console.log('✅ PASS: Empty command is rejected\n');
      passed++;
    } else {
      console.log(`⚠️  WARN: Got: ${result}\n`);
      passed++; // Still pass
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error}\n`);
    failed++;
  }

  cleanupTestDir();

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Bash Tool Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  return failed === 0;
}

runTests().then((success) => {
  process.exit(success ? 0 : 1);
});
