import { Client } from "./Client";

const viewer = document.getElementById("imageViewer") as HTMLDivElement;

(async() => {
  const client = new Client();

  const passwordInput = prompt("Enter password:");

  if (passwordInput) {
    client.setPassword(passwordInput);

    try{
      await client.load();
    }catch(e){
      alert("Failed to load content: " + e);
      return;
    }
    
    client.currentManifestIndex = 0;
    client.currentFileIndex = 0;

    const content = await client.getContent();

    const url = URL.createObjectURL(content);
                
    const imgTag = document.createElement("img");
    imgTag.src = url;
    viewer.appendChild(imgTag);
  }
})();