/*
<ai_context>
Utility functions for image compression and validation
</ai_context>
*/

export async function compressImage(
  file: File,
  maxSizeKB: number = 500
): Promise<File> {
  return new Promise(resolve => {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()

    img.onload = () => {
      // Calculate new dimensions (max 512x512 for icons)
      const maxDimension = 512
      let { width, height } = img

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height * maxDimension) / width
          width = maxDimension
        } else {
          width = (width * maxDimension) / height
          height = maxDimension
        }
      }

      canvas.width = width
      canvas.height = height

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height)

      // Try different quality levels until we get under the size limit
      let quality = 0.8

      const tryCompress = () => {
        canvas.toBlob(
          blob => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now()
              })

              // If still too large and quality can be reduced, try again
              if (blob.size > maxSizeKB * 1024 && quality > 0.1) {
                quality -= 0.1
                tryCompress()
              } else {
                resolve(compressedFile)
              }
            } else {
              resolve(file) // Return original if compression fails
            }
          },
          "image/jpeg",
          quality
        )
      }

      tryCompress()
    }

    img.onerror = () => resolve(file) // Return original if image loading fails
    img.src = URL.createObjectURL(file)
  })
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}
