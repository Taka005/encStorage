import { Client } from "./Client";
import { Manifest } from "./models/Manifest";

const params = new URLSearchParams(document.location.search);
const viewer = document.getElementById("imageViewer") as HTMLDivElement;

(async() => {
  const client = new Client();

  const loadedImages = new Map();

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

  const indexParam = params.get("manifestIndex");
  const fileIndexParam = params.get("fileIndex");

  const manifestIndex = indexParam ? parseInt(indexParam) : null;
  const fileIndex = fileIndexParam ? parseInt(fileIndexParam) : null;

  if(manifestIndex === null || manifestIndex < 0 || manifestIndex >= client.manifestCount) {
    alert("Invalid manifest index");

    window.location.href = "index.html";

    return;
  }

  const manifest = client.getManifest(manifestIndex);

  if(fileIndex === null || fileIndex < 0 || fileIndex >= manifest.fileCount) {
    alert("Invalid file index");

    window.location.href = `index.html?manifestIndex=${manifestIndex}`;

    return;
  }

  let contentIndex = 0;

  const container = document.querySelector(".viewer-container") as HTMLDivElement;
  container.addEventListener("scroll", async () => {
    const scrollLeft = container.scrollLeft;
    const width = container.clientWidth;
    const newIndex = Math.round(scrollLeft / width);

    if (newIndex !== contentIndex) {
      contentIndex = newIndex;
      await updateImages(manifest, fileIndex, contentIndex);
    }
  });

  await updateImages(manifest, fileIndex, contentIndex);

  async function updateImages(manifest: Manifest,fileIndex: number, contentIndex: number) {
    for (let i = contentIndex - 3; i <= contentIndex + 3; i++) {
      if (i >= 0 && i < manifest.fileCount && !loadedImages.has(i)) {
        const content = await manifest.getContent(fileIndex,i);

        const url = URL.createObjectURL(content);

        const imgTag = document.createElement("img");
        imgTag.src = url;

        viewer.appendChild(imgTag);
        loadedImages.set(i, imgTag);
      }
    }

    for (const [index, imgElement] of loadedImages.entries()) {
      if (index < contentIndex - 3 || index > contentIndex + 3) {
        URL.revokeObjectURL(imgElement.src);
        imgElement.remove();
        loadedImages.delete(index);
      }
    }
  }
})();
