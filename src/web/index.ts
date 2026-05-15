import { Client } from "./Client";

const viewer = document.getElementById("imageViewer") as HTMLDivElement;

(async() => {
  const client = new Client();

  if(!client.isPasswordSet){
    const passwordInput = prompt("Enter password:");

    if (!passwordInput) {
      alert("Password is required to load content");
      return;
    }

    client.setPassword(passwordInput);
  }

  if (client.isPasswordSet) {
    try{
      await client.load();
    }catch(e){
      alert("Failed to load content: " + e);
      return;
    }

    client.currentManifestIndex = 0;
    client.currentFileIndex = 0;
    client.currentContentIndex = 0;

    const content = await client.getContent();

    const url = URL.createObjectURL(content);

    const imgTag = document.createElement("img");
    imgTag.src = url;
    viewer.appendChild(imgTag);
  }else{
    alert("Password is required to load content");
  }
})();