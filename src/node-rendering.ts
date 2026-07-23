import { InstancedBufferAttribute, PlaneGeometry, ShaderMaterial } from "three";

import { encodeNodeShape } from "./node-shapes";
import type { GraphraumNodeShape } from "./types";

const vertexShader = `
attribute float instanceShape;
varying vec3 nodeColor;
varying vec2 nodePoint;
varying float nodeShape;

void main() {
	nodeColor = instanceColor;
	nodePoint = position.xy;
	nodeShape = instanceShape;

	vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
	float scaleX = length(instanceMatrix[0].xyz);
	float scaleY = length(instanceMatrix[1].xyz);
	center.xy += position.xy * vec2(scaleX, scaleY);
	gl_Position = projectionMatrix * center;
}
`;

const fragmentShader = `
varying vec3 nodeColor;
varying vec2 nodePoint;
varying float nodeShape;

void main() {
	float distanceToEdge;
	if (nodeShape < 0.5) {
		distanceToEdge = 1.0 - length(nodePoint);
	} else if (nodeShape < 1.5) {
		distanceToEdge = 1.0 - max(abs(nodePoint.x), abs(nodePoint.y));
	} else {
		distanceToEdge = 1.0 - abs(nodePoint.x) - abs(nodePoint.y);
	}
	float alpha = smoothstep(0.0, fwidth(distanceToEdge), distanceToEdge);
	if (alpha <= 0.0) discard;
	gl_FragColor = vec4(nodeColor, alpha);
}
`;

export function createNodeGeometry(capacity: number) {
	const geometry = new PlaneGeometry(2, 2);
	geometry.setAttribute("instanceShape", new InstancedBufferAttribute(new Float32Array(capacity), 1));
	return geometry;
}

export function createNodeMaterial() {
	return new ShaderMaterial({
		fragmentShader,
		transparent: true,
		vertexShader,
	});
}

export function setNodeShapeAt(
	attribute: InstancedBufferAttribute,
	index: number,
	shape: GraphraumNodeShape | undefined,
) {
	attribute.setX(index, encodeNodeShape(shape));
}
