import { PDFDocument } from 'pdf-lib';
import { supabase } from './supabaseService.js';
import fs from 'fs';
import path from 'path';

/**
 * Split a multi-page PDF into individual pages and upload to Supabase.
 * Optimized for large PDFs by using batching and parallel uploads.
 */
export async function splitAndUploadPdf(filePath, fileNamePrefix) {
  console.log(`[DesignImportService] Starting optimized split for: ${filePath}`);
  
  const existingPdfBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const pageCount = pdfDoc.getPageCount();
  console.log(`[DesignImportService] PDF has ${pageCount} pages.`);

  const results = [];
  const BATCH_SIZE = 10; // Process 10 pages in parallel at a time

  for (let i = 0; i < pageCount; i += BATCH_SIZE) {
    const end = Math.min(i + BATCH_SIZE, pageCount);
    console.log(`[DesignImportService] Processing batch: pages ${i + 1} to ${end}...`);
    
    const batchPromises = [];
    for (let j = i; j < end; j++) {
      batchPromises.push((async (pageIdx) => {
        try {
          const newPdf = await PDFDocument.create();
          const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIdx]);
          newPdf.addPage(copiedPage);
          
          const pdfBytes = await newPdf.save();
          const fileName = `${fileNamePrefix}_p${pageIdx + 1}_${Date.now()}.pdf`;
          const storagePath = `temp/${fileName}`;

          const { data, error } = await supabase.storage
            .from('design-assets')
            .upload(storagePath, pdfBytes, {
              contentType: 'application/pdf',
              upsert: true
            });

          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage
            .from('design-assets')
            .getPublicUrl(storagePath);

          return {
            pageIndex: pageIdx,
            url: publicUrl,
            fileName: fileName
          };
        } catch (err) {
          console.error(`[DesignImportService] Error on page ${pageIdx + 1}:`, err.message);
          return null;
        }
      })(j));
    }

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(r => r !== null));
    console.log(`[DesignImportService] Batch ${i / BATCH_SIZE + 1} complete. Total results: ${results.length}`);
  }

  console.log(`[DesignImportService] All ${pageCount} pages processed successfully.`);
  return results;
}

/**
 * Create a new destination record in the database
 */
export async function createDestination(destinationData) {
  const { data, error } = await supabase
    .from('destinations')
    .insert([destinationData])
    .select();

  if (error) throw error;
  return data[0];
}

/**
 * List all destinations
 */
export async function getDestinations() {
  const { data, error } = await supabase
    .from('destinations')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Delete a destination record by ID
 */
export async function deleteDestination(id) {
  const { error } = await supabase
    .from('destinations')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}
