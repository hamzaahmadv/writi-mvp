/*
<ai_context>
Modal component that handles cover picker with tabs (Gallery, Upload, Link)
</ai_context>
*/

"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Image, Upload, Link2, Trash2, Move } from "lucide-react"
import CoverGalleryTab from "./cover-gallery-tab"
import UploadCoverTab from "./upload-cover-tab"
import LinkCoverTab from "./link-cover-tab"
import { PageCover } from "@/types"

interface CoverPickerProps {
  isOpen: boolean
  onClose: () => void
  currentCover?: PageCover
  onCoverSelect: (cover: PageCover) => void
  onCoverRemove: () => void
  onRepositionCover?: () => void
}

export default function CoverPicker({
  isOpen,
  onClose,
  currentCover,
  onCoverSelect,
  onCoverRemove,
  onRepositionCover
}: CoverPickerProps) {
  const [activeTab, setActiveTab] = useState("gallery")

  const handleCoverSelect = (cover: PageCover) => {
    onCoverSelect(cover)
    onClose()
  }

  const handleRemoveCover = () => {
    onCoverRemove()
    onClose()
  }

  const handleRepositionCover = () => {
    if (onRepositionCover) {
      onRepositionCover()
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl border border-gray-200 bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Image className="size-5" />
              <span>Add cover</span>
            </div>
            <div className="flex items-center space-x-2">
              {currentCover && onRepositionCover && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRepositionCover}
                  className="text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-700"
                >
                  <Move className="mr-2 size-4" />
                  Reposition
                </Button>
              )}
              {currentCover && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveCover}
                  className="text-sm text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="mr-2 size-4" />
                  Remove
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-none border-b border-gray-200 bg-white p-0">
            <TabsTrigger
              value="gallery"
              className="flex items-center space-x-2 rounded-none border-0 bg-transparent pb-3 text-gray-500 data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:font-medium data-[state=active]:text-black"
            >
              <Image className="size-4" />
              <span>Gallery</span>
            </TabsTrigger>
            <TabsTrigger
              value="upload"
              className="flex items-center space-x-2 rounded-none border-0 bg-transparent pb-3 text-gray-500 data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:font-medium data-[state=active]:text-black"
            >
              <Upload className="size-4" />
              <span>Upload</span>
            </TabsTrigger>
            <TabsTrigger
              value="link"
              className="flex items-center space-x-2 rounded-none border-0 bg-transparent pb-3 text-gray-500 data-[state=active]:border-b-2 data-[state=active]:border-black data-[state=active]:font-medium data-[state=active]:text-black"
            >
              <Link2 className="size-4" />
              <span>Link</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gallery" className="mt-4 bg-white">
            <CoverGalleryTab onCoverSelect={handleCoverSelect} />
          </TabsContent>

          <TabsContent value="upload" className="mt-4 bg-white">
            <UploadCoverTab
              onCoverSelect={handleCoverSelect}
              onClose={onClose}
            />
          </TabsContent>

          <TabsContent value="link" className="mt-4 bg-white">
            <LinkCoverTab onCoverSelect={handleCoverSelect} onClose={onClose} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
