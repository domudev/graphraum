import type { GraphraumDiagnostics } from "../../src";

export interface PerformanceSample {
	cpuMilliseconds: number;
	frameMilliseconds: number;
	gpuMilliseconds: number | null;
}

export interface PerformanceResult {
	cpuMeanMilliseconds: number;
	fps: number;
	frameP95Milliseconds: number;
	gpuMeanMilliseconds: number | null;
	longTaskShare: number;
	samples: readonly PerformanceSample[];
}

interface MeasuredRenderer {
	getDiagnostics(): GraphraumDiagnostics;
	render(): void;
}

function nextFrame() {
	return new Promise<number>((resolve) => requestAnimationFrame(resolve));
}

function mean(values: readonly number[]) {
	return values.reduce((total, value) => total + value, 0) / values.length;
}

export async function measurePerformance(
	renderer: MeasuredRenderer,
	sampleCount = 120,
	onSample?: (samples: readonly PerformanceSample[]) => void,
): Promise<PerformanceResult> {
	for (let index = 0; index < 10; index += 1) {
		renderer.render();
		await nextFrame();
	}
	const longTasks: number[] = [];
	const observer =
		"PerformanceObserver" in window && PerformanceObserver.supportedEntryTypes.includes("longtask")
			? new PerformanceObserver((list) => longTasks.push(...list.getEntries().map((entry) => entry.duration)))
			: null;
	observer?.observe({ type: "longtask" });
	const samples: PerformanceSample[] = [];
	const startedAt = performance.now();
	let previous = await nextFrame();
	for (let index = 0; index < sampleCount; index += 1) {
		renderer.render();
		const current = await nextFrame();
		const diagnostics = renderer.getDiagnostics();
		samples.push({
			cpuMilliseconds: diagnostics.cpuFrameMilliseconds,
			frameMilliseconds: current - previous,
			gpuMilliseconds: diagnostics.gpuFrameMilliseconds,
		});
		onSample?.(samples);
		previous = current;
	}
	observer?.disconnect();
	const duration = performance.now() - startedAt;
	const frameTimes = samples.map((sample) => sample.frameMilliseconds).toSorted((left, right) => left - right);
	const gpuTimes = samples.flatMap((sample) => (sample.gpuMilliseconds === null ? [] : [sample.gpuMilliseconds]));
	return {
		cpuMeanMilliseconds: mean(samples.map((sample) => sample.cpuMilliseconds)),
		fps: 1_000 / mean(frameTimes),
		frameP95Milliseconds: frameTimes[Math.ceil(frameTimes.length * 0.95) - 1] ?? 0,
		gpuMeanMilliseconds: gpuTimes.length === 0 ? null : mean(gpuTimes),
		longTaskShare: Math.min(longTasks.reduce((total, value) => total + value, 0) / duration, 1),
		samples,
	};
}

export function renderPerformanceChart(element: SVGSVGElement, samples: readonly PerformanceSample[]) {
	const namespace = "http://www.w3.org/2000/svg";
	const width = 240;
	const height = 90;
	const maximum = Math.max(16.7, ...samples.map((sample) => sample.frameMilliseconds));
	const path = (values: readonly number[], color: string) => {
		const line = document.createElementNS(namespace, "polyline");
		line.setAttribute(
			"points",
			values
				.map(
					(value, index) =>
						`${(index / Math.max(values.length - 1, 1)) * width},${height - (value / maximum) * height}`,
				)
				.join(" "),
		);
		line.setAttribute("fill", "none");
		line.setAttribute("stroke", color);
		line.setAttribute("stroke-width", "1.5");
		return line;
	};
	const budget = document.createElementNS(namespace, "line");
	const budgetY = height - (16.7 / maximum) * height;
	budget.setAttribute("x2", String(width));
	budget.setAttribute("y1", String(budgetY));
	budget.setAttribute("y2", String(budgetY));
	budget.setAttribute("class", "performance-budget");
	const gpuSamples = samples.flatMap((sample) => (sample.gpuMilliseconds === null ? [] : [sample.gpuMilliseconds]));
	element.replaceChildren(
		budget,
		path(
			samples.map((sample) => sample.frameMilliseconds),
			"#2d8b6a",
		),
		path(
			samples.map((sample) => sample.cpuMilliseconds),
			"#171717",
		),
		...(gpuSamples.length === 0 ? [] : [path(gpuSamples, "#e4a853")]),
	);
}
