// 命令只来自服务端配置，源码以文件传入；所有编译、语法检查和运行都在沙箱内。
const javaOptions = [
  '-XX:+UseSerialGC',
  '-XX:ActiveProcessorCount=1',
  '-Xms8m',
  '-Xmx128m',
  '-XX:CompressedClassSpaceSize=32m',
  '-XX:ReservedCodeCacheSize=32m',
  '-Djava.io.tmpdir=/w',
]
const javaEnvironment = [`JAVA_TOOL_OPTIONS=${javaOptions.join(' ')}`]

export const runtimes = {
  c: {
    compile: ['/usr/bin/clang', '-std=c17', '-O2', 'main.c', '-lm', '-o', 'main'],
    artifact: 'main',
    run: ['./main'],
  },
  cpp: {
    compile: ['/usr/bin/clang++', '-std=c++17', '-O2', 'main.cpp', '-o', 'main'],
    artifact: 'main',
    run: ['./main'],
  },
  python: { run: ['/usr/bin/python3', '-I', 'main.py'] },
  java: {
    compile: [
      '/bin/sh',
      '-ec',
      'javac -encoding UTF-8 -d classes Main.java && jar --create --file main.jar --main-class Main -C classes .',
    ],
    artifact: 'main.jar',
    run: ['/usr/bin/java', ...javaOptions, '-jar', 'main.jar'],
    compileEnv: javaEnvironment,
  },
  javascript: {
    compile: ['/usr/bin/node', '--check', 'main.js'],
    run: ['/usr/bin/node', 'main.js'],
  },
  typescript: {
    compile: [
      '/usr/bin/tsc',
      '--target',
      'ES2020',
      '--module',
      'commonjs',
      '--types',
      'node',
      '--typeRoots',
      '/usr/share/nodejs/@types',
      '--skipLibCheck',
      '--noEmitOnError',
      'main.ts',
    ],
    artifact: 'main.js',
    run: ['/usr/bin/node', 'main.js'],
  },
  go: {
    compile: ['/usr/bin/go', 'build', '-o', 'main', 'main.go'],
    compileEnv: [
      'GOCACHE=/tmp/go-cache',
      'GOPATH=/tmp/go',
      'GO111MODULE=off',
      'GOTOOLCHAIN=local',
      'GOPROXY=off',
      'CGO_ENABLED=0',
      'GOMAXPROCS=2',
    ],
    artifact: 'main',
    run: ['./main'],
  },
  rust: {
    compile: ['/usr/bin/rustc', '--edition=2021', '-O', 'main.rs', '-o', 'main'],
    artifact: 'main',
    run: ['./main'],
  },
  csharp: {
    compile: ['/usr/bin/mcs', '-optimize+', '-out:main.exe', 'Main.cs'],
    artifact: 'main.exe',
    run: ['/usr/bin/mono', 'main.exe'],
  },
  kotlin: {
    compile: ['/usr/bin/kotlinc', 'Main.kt', '-include-runtime', '-d', 'main.jar'],
    compileEnv: javaEnvironment,
    artifact: 'main.jar',
    run: ['/usr/bin/java', ...javaOptions, '-jar', 'main.jar'],
  },
  swift: {
    compile: [
      '/usr/local/swift/usr/bin/swiftc',
      '-O',
      '-module-cache-path',
      '/tmp/swift-cache',
      'main.swift',
      '-o',
      'main',
    ],
    artifact: 'main',
    run: ['./main'],
  },
  php: { compile: ['/usr/bin/php', '-n', '-l', 'main.php'], run: ['/usr/bin/php', '-n', 'main.php'] },
  ruby: { compile: ['/usr/bin/ruby', '-c', 'main.rb'], run: ['/usr/bin/ruby', 'main.rb'] },
  lua: { compile: ['/usr/bin/luac5.4', '-p', 'main.lua'], run: ['/usr/bin/lua5.4', 'main.lua'] },
  perl: { compile: ['/usr/bin/perl', '-c', 'main.pl'], run: ['/usr/bin/perl', 'main.pl'] },
  r: {
    compile: ['/usr/bin/Rscript', '--vanilla', '-e', 'invisible(parse(file="main.r"))'],
    run: ['/usr/bin/Rscript', '--vanilla', 'main.r'],
  },
  bash: { compile: ['/bin/bash', '-n', 'main.sh'], run: ['/bin/bash', '--noprofile', '--norc', 'main.sh'] },
}
