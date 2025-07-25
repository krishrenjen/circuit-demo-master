"use client";
import {
  BaseElement,
  BaseElementProps,
} from "@/components/circuit/core/BaseElement";
import { useEffect, useState } from "react";
import { Image, Line } from "react-konva";

export default function Resistor(props: BaseElementProps) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const image = new window.Image();
    image.src = "/circuit_elements/resistor.svg";
    image.onload = () => setImg(image);
    image.alt = "Resistor";
  }, []);

  return (
    <BaseElement {...props}>
      {img && (
        <Image
          image={img}
          width={40}
          height={40}
          shadowColor={props.selected ? "blue" : undefined}
          shadowBlur={props.selected ? 15 : 0}
          shadowOffset={{ x: 0, y: 0 }}
          shadowOpacity={props.selected ? 0.6 : 0}
        />
      )}
      <Line
        points={[0, 0, 0, -3]}
        stroke="black"
        strokeWidth={4}
        hitStrokeWidth={10}
        lineCap="round"
        x={-5}
        y={20}
        rotation={90}
      />
      <Line
        points={[0, 0, 0, -3]}
        stroke="black"
        strokeWidth={4}
        hitStrokeWidth={10}
        lineCap="round"
        x={42}
        y={20}
        rotation={90}
      />
    </BaseElement>
  );
}
