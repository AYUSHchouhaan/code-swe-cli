import { Box, Text } from 'ink';
import type { LogLine } from './types';
import { TOOL_ICON, TOOL_COLOR, compact } from './helpers';

export default function Line({ line }: { line: LogLine }) {
  switch (line.kind) {
    case 'user_query':
      return (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text bold color="cyan">▸ </Text>
            <Text bold color="white">{line.text}</Text>
          </Box>
        </Box>
      );

    case 'thinking':
      return (
        <Box paddingLeft={3}>
          <Text dimColor>· · ·</Text>
        </Box>
      );

    case 'tool_call': {
      const icon = TOOL_ICON[line.name] ?? '  ';
      const color = (TOOL_COLOR[line.name] ?? 'white') as any;
      return (
        <Box paddingLeft={2} marginTop={1}>
          <Text color={color}>{icon} </Text>
          <Text bold color={color}>{line.name}</Text>
          <Text dimColor>  {line.args}</Text>
        </Box>
      );
    }

    case 'tool_result': {
      if (line.name === 'glob') {
        const rows = line.result.split('\n').filter(Boolean);
        const header = rows[0] ?? '';
        const files = rows.slice(1);
        return (
          <Box paddingLeft={5} flexDirection="column">
            <Text dimColor>{header}</Text>
            {files.map((f, i) => (
              <Box key={i}>
                <Text color="blue">{i === files.length - 1 ? '└─ ' : '├─ '}</Text>
                <Text>{f}</Text>
              </Box>
            ))}
          </Box>
        );
      }
      return (
        <Box paddingLeft={5}>
          <Text dimColor>{line.result}</Text>
        </Box>
      );
    }

    case 'edit_message':
      return (
        <Box paddingLeft={2} marginTop={1}>
          <Text color="yellow">📝 </Text>
          <Text color="yellow">{compact(line.message, 150)}</Text>
        </Box>
      );

    case 'edit_detail':
      return (
        <Box paddingLeft={5} flexDirection="column">
          <Box>
            <Text dimColor>[{line.index}/{line.total}] </Text>
            <Text color="yellow">{line.filePath}</Text>
          </Box>
          <Box marginTop={0} paddingLeft={2} flexDirection="column">
            <Text color="red">- {line.oldStr}</Text>
          </Box>
          <Box marginTop={0} paddingLeft={2} flexDirection="column">
            <Text color="green">+ {line.newStr}</Text>
          </Box>
        </Box>
      );

    case 'llm_text':
      return (
        <Box paddingLeft={2} marginTop={1}>
          <Text color="magenta">◆ </Text>
          <Text dimColor>{line.text}</Text>
        </Box>
      );

    case 'done':
      return (
        <Box marginTop={1} flexDirection="column" paddingX={2} paddingY={0}>
          <Text bold color="green">✓  Done</Text>
          <Box marginTop={1}>
            <Text>{line.summary}</Text>
          </Box>
        </Box>
      );

    case 'error':
      return (
        <Box marginTop={1} borderStyle="round" borderColor="red" paddingX={2}>
          <Text color="red">✗  {line.message}</Text>
        </Box>
      );
  }
}
