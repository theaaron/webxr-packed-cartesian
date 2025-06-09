uniform float pointSize;
uniform float time;

void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    float pulse = 1.0 + 0.1 * sin(time * 2.0);

    gl_PointSize = pointSize * pulse * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
}