$f = "components\HomeScreen.tsx"
$lines = [System.IO.File]::ReadAllLines($f, [System.Text.Encoding]::UTF8)
$lines[198] = "              { icon: 'MIC',    accent: 'card-accent-blue',   grad: 'from-blue-500/20',    title: 'Real-Time Speech Analysis',        desc: 'Detects hesitation, filler words, and response timing the moment you speak.' },"
$lines[199] = "              { icon: 'TIMER',  accent: 'card-accent-rose',   grad: 'from-rose-500/20',    title: 'Pressure Meter Visualisation',     desc: 'A live dynamic gauge that reacts to your stress patterns throughout the session.' },"
$lines[200] = "              { icon: 'CHART',  accent: 'card-accent-green',  grad: 'from-emerald-500/20', title: 'Behavioural Performance Scoring',  desc: 'Measures Clarity, Composure, and Structure - not just answer correctness.' },"
$lines[201] = "              { icon: 'FIRE',   accent: 'card-accent-amber',  grad: 'from-amber-500/20',   title: 'Immersive Stress Simulation',      desc: 'Time-bound questioning that mimics the tension of real high-stakes interviews.' },"
$lines[202] = "              { icon: 'AI',     accent: 'card-accent-purple', grad: 'from-purple-500/20',  title: 'AI-Heuristic Hybrid Engine',       desc: 'Combines delay, speech patterns, and structure into a single Confidence Score.' },"
$lines[203] = "              { icon: 'RETRY',  accent: 'card-accent-cyan',   grad: 'from-cyan-500/20',    title: 'Retry & Progress Tracking',        desc: 'See measurable improvement across multiple attempts with session history.' },"
[System.IO.File]::WriteAllLines($f, $lines, [System.Text.Encoding]::UTF8)
Write-Host "Done"
