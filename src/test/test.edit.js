"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const edit_1 = require("../src/tools/edit");
/**
 * Test suite for the Edit Tool
 * Tests various scenarios including:
 * - Single edit
 * - Multiple edits
 * - Error cases (missing oldStr, non-existent file)
 * - Whitespace sensitivity
 */
const TEST_DIR = path_1.default.join(__dirname, 'temp-edit-test');
// Setup: Create test directory
function setupTestDir() {
    if (!fs_1.default.existsSync(TEST_DIR)) {
        fs_1.default.mkdirSync(TEST_DIR, { recursive: true });
    }
}
// Cleanup: Remove test directory
function cleanupTestDir() {
    if (fs_1.default.existsSync(TEST_DIR)) {
        fs_1.default.rmSync(TEST_DIR, { recursive: true, force: true });
    }
}
// Helper to create a test file
function createTestFile(filename, content) {
    const filePath = path_1.default.join(TEST_DIR, filename);
    fs_1.default.writeFileSync(filePath, content, 'utf-8');
}
// Helper to read file content
function readTestFile(filename) {
    const filePath = path_1.default.join(TEST_DIR, filename);
    return fs_1.default.readFileSync(filePath, 'utf-8');
}
async function runTests() {
    console.log('🧪 Starting Edit Tool Tests...\n');
    let passed = 0;
    let failed = 0;
    setupTestDir();
    const editTool = (0, edit_1.createEditTool)(TEST_DIR);
    // Test 1: Single edit
    console.log('Test 1: Single edit');
    try {
        createTestFile('test1.txt', 'Hello World');
        const result = await editTool.invoke({
            filePath: 'test1.txt',
            edits: [{ oldStr: 'World', newStr: 'LangGraph' }],
        });
        const content = readTestFile('test1.txt');
        if (content === 'Hello LangGraph' && result.includes('Successfully applied')) {
            console.log('✅ PASS: Single edit works\n');
            passed++;
        }
        else {
            console.log(`❌ FAIL: Expected 'Hello LangGraph', got '${content}'\n`);
            failed++;
        }
    }
    catch (error) {
        console.log(`❌ FAIL: ${error}\n`);
        failed++;
    }
    // Test 2: Multiple sequential edits
    console.log('Test 2: Multiple sequential edits');
    try {
        createTestFile('test2.txt', 'const x = 1;\nconst y = 2;\nconst z = 3;');
        const result = await editTool.invoke({
            filePath: 'test2.txt',
            edits: [
                { oldStr: 'const x = 1;', newStr: 'const x = 10;' },
                { oldStr: 'const y = 2;', newStr: 'const y = 20;' },
            ],
        });
        const content = readTestFile('test2.txt');
        const expected = 'const x = 10;\nconst y = 20;\nconst z = 3;';
        if (content === expected && result.includes('applied 2 edit')) {
            console.log('✅ PASS: Multiple edits work sequentially\n');
            passed++;
        }
        else {
            console.log(`❌ FAIL: Expected:\n${expected}\nGot:\n${content}\n`);
            failed++;
        }
    }
    catch (error) {
        console.log(`❌ FAIL: ${error}\n`);
        failed++;
    }
    // Test 3: Whitespace sensitivity
    console.log('Test 3: Whitespace sensitivity (exact match required)');
    try {
        createTestFile('test3.ts', `function test() {
  const name = 'John';
  console.log(name);
}`);
        const result = await editTool.invoke({
            filePath: 'test3.ts',
            edits: [
                {
                    oldStr: "  const name = 'John';",
                    newStr: "  const name = 'Jane';",
                },
            ],
        });
        const content = readTestFile('test3.ts');
        if (content.includes("'Jane'") && result.includes('Successfully applied')) {
            console.log('✅ PASS: Whitespace sensitivity works\n');
            passed++;
        }
        else {
            console.log(`❌ FAIL: Whitespace edit failed\n`);
            failed++;
        }
    }
    catch (error) {
        console.log(`❌ FAIL: ${error}\n`);
        failed++;
    }
    // Test 4: Error case - oldStr not found
    console.log('Test 4: Error handling - oldStr not found');
    try {
        createTestFile('test4.txt', 'Hello World');
        const result = await editTool.invoke({
            filePath: 'test4.txt',
            edits: [{ oldStr: 'NonExistent', newStr: 'NewText' }],
        });
        if (result.includes('Error') && result.includes('not found')) {
            console.log('✅ PASS: Correctly reports missing oldStr\n');
            passed++;
        }
        else {
            console.log(`❌ FAIL: Expected error message, got: ${result}\n`);
            failed++;
        }
    }
    catch (error) {
        console.log(`❌ FAIL: ${error}\n`);
        failed++;
    }
    // Test 5: Error case - file does not exist
    console.log('Test 5: Error handling - file does not exist');
    try {
        const result = await editTool.invoke({
            filePath: 'nonexistent.txt',
            edits: [{ oldStr: 'test', newStr: 'test2' }],
        });
        if (result.includes('Error') && result.includes('does not exist')) {
            console.log('✅ PASS: Correctly reports missing file\n');
            passed++;
        }
        else {
            console.log(`❌ FAIL: Expected error message, got: ${result}\n`);
            failed++;
        }
    }
    catch (error) {
        console.log(`❌ FAIL: ${error}\n`);
        failed++;
    }
    // Test 6: Complex multi-line replacement
    console.log('Test 6: Complex multi-line replacement');
    try {
        createTestFile('test6.ts', `export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}`);
        const result = await editTool.invoke({
            filePath: 'test6.ts',
            edits: [
                {
                    oldStr: `export function add(a: number, b: number): number {
  return a + b;
}`,
                    newStr: `export function add(a: number, b: number): number {
  // Adds two numbers
  return a + b;
}`,
                },
            ],
        });
        const content = readTestFile('test6.ts');
        if (content.includes('// Adds two numbers') && result.includes('Successfully applied')) {
            console.log('✅ PASS: Multi-line replacement works\n');
            passed++;
        }
        else {
            console.log(`❌ FAIL: Multi-line replacement failed\n`);
            failed++;
        }
    }
    catch (error) {
        console.log(`❌ FAIL: ${error}\n`);
        failed++;
    }
    // Test 7: Replace only first occurrence
    console.log('Test 7: Replace only first occurrence');
    try {
        createTestFile('test7.txt', 'apple apple apple');
        const result = await editTool.invoke({
            filePath: 'test7.txt',
            edits: [{ oldStr: 'apple', newStr: 'orange' }],
        });
        const content = readTestFile('test7.txt');
        if (content === 'orange apple apple' && result.includes('Successfully applied')) {
            console.log('✅ PASS: Replaces only first occurrence\n');
            passed++;
        }
        else {
            console.log(`❌ FAIL: Expected 'orange apple apple', got '${content}'\n`);
            failed++;
        }
    }
    catch (error) {
        console.log(`❌ FAIL: ${error}\n`);
        failed++;
    }
    cleanupTestDir();
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Edit Tool Test Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(50));
    return failed === 0;
}
runTests().then((success) => {
    process.exit(success ? 0 : 1);
});
//# sourceMappingURL=test.edit.js.map