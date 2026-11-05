/**
 * Universal Secure File Downloader for Exports (Excel .xlsx and CSV)
 * - Uses Authorization bearer token in request headers
 * - Checks response status: if token expired (401) or forbidden (403), alerts the user cleanly
 * - Triggers instant client-side file save with guaranteed filename and extension
 */
export async function downloadExportFile(url, fallbackFilename, token) {
  try {
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers });

    if (!res.ok) {
      let message = `Export failed with status ${res.status}`;
      try {
        const data = await res.json();
        if (data.error) message = data.error;
      } catch (_) {}
      alert(`Download Error: ${message}\n\nPlease refresh or sign in again if your session has expired.`);
      return false;
    }

    // Extract filename from Content-Disposition header if present
    let filename = fallbackFilename;
    const disposition = res.headers.get('content-disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        filename = match[1].trim();
      }
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    return true;
  } catch (err) {
    console.error('Download export file error:', err);
    alert('Failed to download file: ' + err.message);
    return false;
  }
}

