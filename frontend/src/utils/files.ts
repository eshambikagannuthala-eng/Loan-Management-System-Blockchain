export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const filesToBase64Array = async (files: FileList | File[]): Promise<string[]> => {
  const arr = Array.from(files || []);
  return Promise.all(arr.map(fileToBase64));
};
