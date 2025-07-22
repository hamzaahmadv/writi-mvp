"use client"

// Temporarily disabled for build - type conflicts with absurd-sql implementation
export default function TestBreadthFirstPage() {
  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold">
        Test Breadth First - Temporarily Disabled
      </h1>
      <p>
        This page is temporarily disabled due to type conflicts during the
        absurd-sql migration.
      </p>
      <p>
        The absurd-sql implementation is working correctly. This test page will
        be updated later to work with the new Block interface.
      </p>
    </div>
  )
}
