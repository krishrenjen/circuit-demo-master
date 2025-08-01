import type { PyodideInterface } from "pyodide";
import { CHARACTER_PATTERNS } from "./characterPatterns";

export type MicrobitEvent =
  | {
      type: "pin-change";
      pin: string;
      value: number;
      pinType: "digital" | "analog";
    }
  | { type: "led-change"; x: number; y: number; value: number }
  | { type: "button-press"; button: "A" | "B" }
  | { type: "reset" };

type MicrobitEventCallback = (event: MicrobitEvent) => void;

class ButtonInstance {
  constructor(private name: "A" | "B") {}

  getName(): "A" | "B" {
    return this.name;
  }

  toString(): string {
    return this.name;
  }
}

class MicrobitEventEmitter {
  private listeners: Set<MicrobitEventCallback> = new Set();

  subscribe(callback: MicrobitEventCallback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit(event: MicrobitEvent) {
    for (const cb of this.listeners) {
      cb(event);
    }
  }
}

export class MicrobitSimulator {
  private pyodide: PyodideInterface;
  private eventEmitter = new MicrobitEventEmitter();
  private ledMatrix: boolean[][] = Array.from({ length: 5 }, () =>
    Array(5).fill(false)
  );
  private pinStates: Record<string, { digital: number; analog: number }> = {};
  private buttonStates: Record<"A" | "B", boolean> = { A: false, B: false };
  private inputHandlers: Record<"A" | "B", any[]> = { A: [], B: [] };
  private foreverCallbacks: Set<any> = new Set();

  public readonly Button = {
    A: new ButtonInstance("A"),
    B: new ButtonInstance("B"),
  };

  public readonly DigitalPin: Record<string, string> = {};
  public readonly pins = {
    digital_write_pin: this.digitalWritePin.bind(this),
    digital_read_pin: this.readDigitalPin.bind(this),
    analog_write_pin: this.analogWritePin.bind(this),
    read_analog_pin: this.readAnalogPin.bind(this),
  };
  public readonly led = {
    plot: this.plot.bind(this),
    unplot: this.unplot.bind(this),
    point: this.point.bind(this),
  };
  public readonly input = {
    on_button_pressed: this.onButtonPressed.bind(this),
    _clear: this.clearInputs.bind(this),
  };
  public readonly basic = {
    show_string: this.showString.bind(this),
    forever: this.forever.bind(this),
    pause: this.pause.bind(this),
  };

  constructor(pyodide: PyodideInterface) {
    this.pyodide = pyodide;

    for (let i = 0; i <= 20; i++) {
      const pin = `P${i}`;
      this.pinStates[pin] = { digital: 0, analog: 0 };
      this.DigitalPin[pin] = pin;
    }
  }

  subscribe(callback: MicrobitEventCallback) {
    return this.eventEmitter.subscribe(callback);
  }

  private async showString(
    text: string,
    interval: number = 150
  ): Promise<void> {
    // Filter to supported characters (preserving case)
    const validChars = text
      .split("")
      .filter((char) => CHARACTER_PATTERNS[char]);

    if (validChars.length === 0) {
      // Clear display if no valid characters
      this.clearDisplay();
      return;
    }

    // Create a scrolling pattern by combining all character patterns
    const scrollPattern: boolean[][] = [];

    // Add each character pattern with a space column between characters
    validChars.forEach((char, index) => {
      const pattern = CHARACTER_PATTERNS[char];
      pattern.forEach((row, rowIndex) => {
        if (!scrollPattern[rowIndex]) {
          scrollPattern[rowIndex] = [];
        }
        // Convert numbers to booleans before pushing
        scrollPattern[rowIndex].push(...row.map((v) => Boolean(v)));

        // Add space column between characters (except for the last character)
        if (index < validChars.length - 1) {
          scrollPattern[rowIndex].push(false);
        }
      });
    });

    // Add padding at the end so text scrolls completely off screen
    for (let rowIndex = 0; rowIndex < 5; rowIndex++) {
      for (let i = 0; i < 5; i++) {
        scrollPattern[rowIndex].push(false);
      }
    }

    let currentOffset = 0;
    const maxOffset = scrollPattern[0].length;

    // Use async/await with setTimeout to make it properly blocking
    while (currentOffset < maxOffset) {
      // Clear current display
      this.clearDisplay();

      // Display current window of the scroll pattern
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          const patternCol = currentOffset + col;
          if (
            patternCol < scrollPattern[row].length &&
            scrollPattern[row][patternCol]
          ) {
            this.plot(col, row);
          }
        }
      }

      currentOffset++;

      // Wait for the interval before showing the next frame
      if (currentOffset < maxOffset) {
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }

    // Clear display when animation is complete
    this.clearDisplay();
  }

  private forever(callback: () => void) {
    // Create a proxy for the Python callback to handle memory management
    const proxy = this.pyodide.pyimport("pyodide.ffi.create_proxy")(callback);

    // Add to the set of forever callbacks
    this.foreverCallbacks.add(proxy);

    // Start each forever callback in its own execution loop
    this.startIndividualForeverLoop(proxy);
  }

  private startIndividualForeverLoop(callback: any) {
    const runCallback = async () => {
      try {
        await callback();
      } catch (error) {
        console.error("Error in forever loop:", error);
      }
      // Schedule the next execution
      setTimeout(runCallback, 20);
    };

    // Start the loop with a small delay
    setTimeout(runCallback, 20);
  }

  private startForeverLoop() {
    // This method is no longer used, keeping for compatibility
    // Individual forever loops are now started separately
  }

  private async pause(ms: number) {
    // Create a promise that resolves after the specified delay
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private clearDisplay() {
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        this.unplot(x, y);
      }
    }
  }

  reset() {
    // Clean up forever callbacks (individual loops will stop when callbacks are destroyed)
    this.foreverCallbacks.forEach((callback) => {
      if (callback.destroy) {
        callback.destroy();
      }
    });
    this.foreverCallbacks.clear();

    for (const pin in this.pinStates) {
      this.pinStates[pin] = { digital: 0, analog: 0 };
    }
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++) this.ledMatrix[x][y] = false;
    this.buttonStates = { A: false, B: false };
    this.clearInputs();
    this.eventEmitter.emit({ type: "reset" });
    console.log("Microbit state reset");
  }

  private digitalWritePin(pin: string, value: number) {
    this.pinStates[pin].digital = value;
    this.eventEmitter.emit({
      type: "pin-change",
      pin,
      value,
      pinType: "digital",
    });
  }

  private readDigitalPin(pin: string) {
    return this.pinStates[pin].digital;
  }

  private analogWritePin(pin: string, value: number) {
    this.pinStates[pin].analog = value;
  }

  private readAnalogPin(pin: string) {
    return this.pinStates[pin].analog;
  }

  private plot(x: number, y: number) {
    this.ledMatrix[x][y] = true;
    this.eventEmitter.emit({ type: "led-change", x, y, value: 1 });
  }

  private unplot(x: number, y: number) {
    this.ledMatrix[x][y] = false;
    this.eventEmitter.emit({ type: "led-change", x, y, value: 0 });
  }

  private point(x: number, y: number) {
    return this.ledMatrix[x][y];
  }

  private onButtonPressed(button: ButtonInstance, handler: () => void) {
    const buttonName = button.getName();
    const proxy = this.pyodide.pyimport("pyodide.ffi.create_proxy")(handler);
    this.inputHandlers[buttonName].push(proxy);
  }

  public pressButton(button: ButtonInstance | "A" | "B") {
    const buttonName = typeof button === "string" ? button : button.getName();
    this.buttonStates[buttonName] = true;
    this.inputHandlers[buttonName].forEach((h) => h());
  }

  private clearInputs() {
    this.inputHandlers.A.forEach((p) => p.destroy?.());
    this.inputHandlers.B.forEach((p) => p.destroy?.());
    this.inputHandlers = { A: [], B: [] };
  }

  getStateSnapshot() {
    return {
      pins: { ...this.pinStates },
      leds: this.ledMatrix.map((row) => [...row]),
      buttons: { ...this.buttonStates },
    };
  }

  getPythonModule() {
    return {
      pins: this.pins,
      led: this.led,
      input: this.input,
      Button: this.Button,
      DigitalPin: this.DigitalPin,
      basic: this.basic,
    };
  }
}
