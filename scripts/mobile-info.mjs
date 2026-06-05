import { networkInterfaces } from "node:os";

const port = Number(process.env.PORT ?? 4173);

const addresses = Object.values(networkInterfaces())
  .flat()
  .filter((entry) => entry?.family === "IPv4" && !entry.internal)
  .map((entry) => entry.address);

console.log("Phone access checklist:");
console.log("1. Connect phone and computer to the same Wi-Fi.");
console.log("2. Start the LAN server with: npm run mobile");
console.log("3. Open one of these URLs on your phone:");

if (addresses.length === 0) {
  console.log("   No LAN IPv4 address found. Check Wi-Fi/network connection.");
} else {
  for (const address of addresses) {
    console.log(`   http://${address}:${port}`);
  }
}

console.log("4. If it does not open, allow Node.js through Windows Firewall for private networks.");
