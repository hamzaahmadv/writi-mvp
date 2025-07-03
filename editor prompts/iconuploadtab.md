📤 Writi Icon Upload Tab — Deep Research & Design Guide

This document provides an in-depth technical and UX breakdown of the “Upload” tab in the Writi page icon picker — modeled after Notion. It is meant to guide Cursor agents (Claude, etc.) in implementing the upload functionality accurately.

⸻

🎯 Purpose

Allow users to upload a custom image to use as a page icon.
	•	Supports PNG, JPG, WebP
	•	Automatically uploads to Supabase Storage
	•	Image is cropped to a square thumbnail
	•	Supports clipboard image paste (⌘+V)
	•	Matches Notion’s minimal UI

⸻

🧠 UX Observations from Notion

Element	Behavior
Upload button	Gray rounded box with icon + label (Upload an image)
Paste support	Users can paste directly (⌘+V / Ctrl+V)
Preview	Image thumbnail shown above tabs, cropped to square
File size	Likely capped (~5MB), resized down on upload
Cancel/Save	Two buttons appear after file is selected
Remove	Top-right button to reset current icon


⸻

🛠 Implementation Plan

1. Supabase Storage Setup
	•	Bucket: icons
	•	Public upload permissions: authenticated users only
	•	Use supabase.storage.from('icons').upload()
	•	Retrieve public URL with getPublicUrl()

interface PageIcon {
  type: 'emoji' | 'icon' | 'image';
  url?: string;
  name?: string;
  color?: string;
}

2. Upload Input UI (Tailwind)

<label className="border-dashed border border-gray-300 bg-gray-50 hover:bg-gray-100 rounded-md p-6 flex items-center justify-center cursor-pointer">
  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
  <div className="text-gray-500 text-sm flex gap-2 items-center">
    <ImageIcon className="w-5 h-5" /> Upload an image
  </div>
</label>

3. Upload Logic

async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;

  const fileName = `${pageId}-${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage.from('icons').upload(fileName, file);

  if (error) throw new Error("Upload failed");

  const url = supabase.storage.from('icons').getPublicUrl(fileName).data.publicUrl;
  await updatePageIcon(pageId, { type: 'image', url });
}

4. Paste Event Handling (Optional)

useEffect(() => {
  const handlePaste = async (e: ClipboardEvent) => {
    const item = e.clipboardData?.items[0];
    if (item?.type.includes("image")) {
      const file = item.getAsFile();
      if (file) await handleUpload({ target: { files: [file] } });
    }
  }
  window.addEventListener("paste", handlePaste);
  return () => window.removeEventListener("paste", handlePaste);
}, []);

5. Save & Cancel Buttons

<div className="flex justify-between mt-4">
  <button className="text-gray-500 text-sm" onClick={resetIcon}>Cancel</button>
  <button className="bg-blue-500 text-white text-sm px-4 py-1 rounded-md" onClick={saveIcon}>Save</button>
</div>


⸻

🔐 Supabase Storage Rules (recommended)

-- Allow uploads only by authenticated users
create policy "Authenticated uploads only"
  on storage.objects for insert
  using (auth.role() = 'authenticated');


⸻

✅ Agent Checklist
	•	Create UploadIconTab.tsx component
	•	Connect to Supabase Storage bucket icons
	•	Show image preview using object-cover
	•	Store uploaded icon as { type: 'image', url: string }
	•	Add paste shortcut (⌘+V)
	•	Handle errors + invalid formats
	•	Add Remove, Cancel, and Save buttons

⸻

This spec is designed for agents working inside the Writi project via Cursor IDE using Tailwind, Supabase, Server Actions, and modular React components.