import { Client } from "./Client";

const params = new URLSearchParams(document.location.search);

const viewer = document.getElementById("imageGrid") as HTMLDivElement;

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

  if (!client.isPasswordSet){
    alert("Password is required to load content");
    return;
  }

  try{
    await client.load();
  }catch(e){
    alert("Failed to load content: " + e);
    return;
  }

  const manifestIndexParam = params.get("manifestIndex");
  const manifestIndex = manifestIndexParam ? parseInt(manifestIndexParam) : null;

  if(manifestIndex === null || manifestIndex < 0 || manifestIndex >= client.manifestCount){
    for(let i = 0; i < client.manifestCount; i++){
      const manifest = client.getManifest(i);

      const content = await manifest.getContent(0,0);

      const url = URL.createObjectURL(content);

      const imgTag = document.createElement("img");
      imgTag.src = url;
      viewer.appendChild(imgTag);

      imgTag.addEventListener("click", () => {
        window.location.href = `index.html?manifestIndex=${i}`;
      });
    }
  }else{
    const manifest = client.getManifest(manifestIndex);

    for(let i = 0; i < manifest.fileCount; i++){
      const content = await manifest.getContent(i,0);

      const url = URL.createObjectURL(content);

      const imgTag = document.createElement("img");
      imgTag.src = url;
      viewer.appendChild(imgTag);

      imgTag.addEventListener("click", () => {
        window.location.href = `reader.html?manifestIndex=${manifestIndex}&fileIndex=${i}`;
      });
    }
  }
})();