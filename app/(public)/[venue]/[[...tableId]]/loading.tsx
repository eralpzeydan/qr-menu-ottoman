export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-[#8D1F25]"></div>
        </div>
        <p className="text-lg font-medium text-gray-700">Menü yükleniyor...</p>
      </div>
    </div>
  );
}
