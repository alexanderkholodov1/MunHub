import { parseSerialLine, type ParserLogger, type RawReading } from "./parsers/index.js";

export interface SerialPortInfo {
  name: string;
  displayName: string;
}

export interface TauriInvoker {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
}

export interface SerialBridgeOptions {
  invoker: TauriInvoker;
  logger?: ParserLogger;
  onReading(reading: RawReading): void;
  onSkippedLine?: (line: string) => void;
}

export async function listSerialPorts(invoker: TauriInvoker): Promise<SerialPortInfo[]> {
  return invoker.invoke<SerialPortInfo[]>("list_serial_ports");
}

export class TauriSerialBridge {
  private readonly invoker: TauriInvoker;
  private readonly logger: ParserLogger | undefined;
  private readonly onReading: (reading: RawReading) => void;
  private readonly onSkippedLine: ((line: string) => void) | undefined;
  private selectedPort: string | null = null;

  constructor(options: SerialBridgeOptions) {
    this.invoker = options.invoker;
    this.logger = options.logger;
    this.onReading = options.onReading;
    this.onSkippedLine = options.onSkippedLine;
  }

  async listPorts(): Promise<SerialPortInfo[]> {
    return listSerialPorts(this.invoker);
  }

  async selectPort(portName: string): Promise<void> {
    this.selectedPort = portName;
    await this.invoker.invoke<void>("open_serial_port", { portName });
  }

  async close(): Promise<void> {
    await this.invoker.invoke<void>("close_serial_port");
    this.selectedPort = null;
  }

  handleSerialLine(line: string): void {
    const reading =
      this.logger === undefined
        ? parseSerialLine(line)
        : parseSerialLine(line, { logger: this.logger });
    if (reading === null) {
      this.onSkippedLine?.(line);
      return;
    }

    this.onReading(reading);
  }

  getSelectedPort(): string | null {
    return this.selectedPort;
  }
}
