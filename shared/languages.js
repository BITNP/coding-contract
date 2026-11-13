// 前端展示、指标适用范围与服务端白名单共用的语言目录。
export const languages = [
  {
    id: 'cpp',
    name: 'C++17',
    editor: 'cpp',
    filename: 'main.cpp',
    analysis: 'clang',
    increment: true,
    tinyMemory: true,
  },
  {
    id: 'c',
    name: 'C17',
    editor: 'c',
    filename: 'main.c',
    analysis: 'clang',
    increment: true,
    tinyMemory: true,
  },
  { id: 'python', name: 'Python 3', editor: 'python', filename: 'main.py', analysis: 'python' },
  { id: 'java', name: 'Java 21', editor: 'java', filename: 'Main.java' },
  { id: 'javascript', name: 'JavaScript', editor: 'javascript', filename: 'main.js' },
  { id: 'typescript', name: 'TypeScript', editor: 'typescript', filename: 'main.ts' },
  { id: 'go', name: 'Go', editor: 'go', filename: 'main.go' },
  { id: 'rust', name: 'Rust 2021', editor: 'rust', filename: 'main.rs', tinyMemory: true },
  { id: 'csharp', name: 'C# (Mono)', editor: 'csharp', filename: 'Main.cs' },
  { id: 'kotlin', name: 'Kotlin', editor: 'kotlin', filename: 'Main.kt' },
  { id: 'swift', name: 'Swift', editor: 'swift', filename: 'main.swift' },
  { id: 'php', name: 'PHP 8', editor: 'php', filename: 'main.php' },
  { id: 'ruby', name: 'Ruby', editor: 'ruby', filename: 'main.rb' },
  { id: 'lua', name: 'Lua 5.4', editor: 'lua', filename: 'main.lua' },
  { id: 'perl', name: 'Perl', editor: 'perl', filename: 'main.pl' },
  { id: 'r', name: 'R', editor: 'r', filename: 'main.r' },
  { id: 'bash', name: 'Bash', editor: 'shell', filename: 'main.sh' },
]

export const languageById = Object.fromEntries(languages.map((language) => [language.id, language]))
