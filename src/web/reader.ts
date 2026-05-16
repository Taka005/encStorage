import { Client } from "./Client";
import { Manifest } from "./models/Manifest";

const params = new URLSearchParams(document.location.search);

const viewer = document.getElementById("imageViewer") as HTMLDivElement;
const container = document.querySelector(".viewer-container") as HTMLDivElement;

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
  let currentId = 0;

  if (!manifest.manifestData) {
    alert("Manifest is not decrypted");

    window.location.href = "index.html";

    return;
  }

  const fileData = manifest.manifestData[fileIndex];
  if (!fileData) {
    alert("File index is out of range");
    window.location.href = `index.html?manifestIndex=${manifestIndex}`;
    return;
  }

  const placeholders: HTMLDivElement[] = [];

  for (let i = 0; i < fileData.files.length; i++) {
    const box = document.createElement("div");
    box.className = "viewer-img-box";
    viewer.appendChild(box);
    placeholders.push(box);
  }

  container.addEventListener("scroll", () => {
    const scrollLeft = container.scrollLeft;
    const width = container.clientWidth;

    if (width === 0) return;

    const newIndex = Math.round(scrollLeft / width);

    if (newIndex !== contentIndex) {
      contentIndex = newIndex;
      updateImages(manifest, fileData.files.length, fileIndex, contentIndex);
    }
  });

  await updateImages(manifest, fileData.files.length, fileIndex, contentIndex);

  async function updateImages(manifest: Manifest,contentCount: number, fileIndex: number, targetIndex: number) {
    const myId = ++currentId;

    const start = Math.max(0, targetIndex - 3);
    const end = Math.min(contentCount - 1, targetIndex + 3);

    for (let i = start; i <= end; i++) {
      if (!loadedImages.has(i)) {
        const content = await manifest.getContent(fileIndex, i);

        if (myId !== currentId) return;

        const url = URL.createObjectURL(content);
        const imgTag = document.createElement("img");
        imgTag.src = url;

        console.log(`Loaded content for fileIndex: ${fileIndex}, contentIndex: ${i}, size: ${content.size} bytes`);

        const placeholder = placeholders[i];
        if (placeholder) {
          placeholder.appendChild(imgTag);
          loadedImages.set(i, imgTag);
        }
      }
    }

    for (const [index, imgElement] of loadedImages.entries()) {
      if (index < targetIndex - 3 || index > targetIndex + 3) {
        URL.revokeObjectURL(imgElement.src);
        imgElement.remove();
        loadedImages.delete(index);
      }
    }
  }
})();
