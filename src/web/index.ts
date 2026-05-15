import { Client } from "./Client";

const client = new Client();

const passwordInput = prompt("Enter password:");

if (passwordInput) {
  client.setPassword(passwordInput);

  client.load()
    .catch(err => {
      alert("Error loading manifests: " + err.message);
    });
}