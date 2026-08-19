// Bootstrap shims so @solana/web3.js runs on Hermes (same set the Solana
// Mobile dapp-scaffold uses). Import this once, before anything else.
import "react-native-get-random-values";
import { Buffer } from "buffer";

// RN runs Hermes, TS runs a browser lib — declare the tiny global we need.
declare const global: { Buffer?: typeof Buffer };

if (typeof global.Buffer === "undefined") {
  global.Buffer = Buffer;
}
