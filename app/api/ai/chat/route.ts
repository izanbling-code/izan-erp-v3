import { createGroq } from '@ai-sdk/groq';
import { generateText, stepCountIs } from 'ai';
import { z } from 'zod';
import { supabase } from '@/app/lib/supabase';
import { NextResponse } from 'next/server';

// ✅ 1. Initialize Groq
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "GROQ_API_KEY is missing in .env" }, { status: 500 });
    }

    const companyId = "001"; 

    const formattedMessages = messages.map((m: any) => ({
      role: m.role === "ai" ? "assistant" : "user",
      content: m.text,
    }));

    const result = await generateText({
      model: groq('openai/gpt-oss-120b'), 
      // ✅ 2. UPDATED SYSTEM PROMPT
      system: `You are Jarvis, the AI assistant for Izan Bling ERP. 
               You help the admin manage their business by creating products, recording payments, and generating accounting entries.

               CRITICAL RULES:
               1. YOU MUST NOT POST, FINALIZE, OR APPROVE ANY ENTRIES. Your job is strictly data entry and suggestion. The admin will review and post the entries manually.
               2. Do not add arbitrary fields like "status: DRAFT" unless explicitly requested. Rely on the software's default behavior when creating records.
               3. Before creating a Journal Entry, ALWAYS use the 'getChartOfAccounts' tool to fetch valid account codes so you don't hallucinate accounts.
               4. Before creating a product, you can use 'getProducts' to check if it already exists.
               5. If a user asks to record a payment, ask for missing details (amount, account, date) before calling the tool.
               6. When recording a payment, you should also suggest the corresponding double-entry (e.g., Debit Cash, Credit Accounts Receivable) using the 'createJournalEntry' tool.

               Be concise and professional. Always remind the user that they need to review and post the entries you create.`,
      messages: formattedMessages,
      stopWhen: stepCountIs(5), // Allows the AI to chain multiple tools together
      tools: {
        // ✅ TOOL 1: CREATE PRODUCT
        createProduct: {
          description: 'Create a new product in the ERP.',
          inputSchema: z.object({ 
            name: z.string().describe('The name of the product'),
            sku: z.string().describe('Unique SKU for the product'),
            price: z.number().describe('Selling price'),
            description: z.string().optional().describe('Product details'),
          }),
          execute: async ({ name, sku, price, description }) => {
            // No forced status. Relies on your DB defaults.
            const { data, error } = await supabase.from('Product').insert({
              companyId,
              name,
              sku,
              price,
              description,
              createdAt: new Date().toISOString(),
            }).select();

            if (error) return { error: `Failed to create product: ${error.message}` };
            return { success: true, productId: data[0].id, message: "Product saved successfully." };
          },
        },

        // ✅ TOOL 2: CREATE JOURNAL ENTRY (Renamed from createDraftJournalEntry)
        createJournalEntry: {
          description: 'Create a double-entry journal entry in the accounting system. Do not post it.',
          inputSchema: z.object({
            date: z.string().describe('ISO date string'),
            memo: z.string().describe('Description of the entry'),
            lines: z.array(z.object({
              accountCode: z.string().describe('Account code from Chart of Accounts'),
              debit: z.number().default(0),
              credit: z.number().default(0)
            })).describe('The debit and credit lines. Total debits must equal total credits.')
          }),
          execute: async ({ date, memo, lines }) => {
            // Basic validation before hitting DB
            const totalDebit = lines.reduce((sum: number, line: { debit: number }) => sum + line.debit, 0);
            const totalCredit = lines.reduce((sum: number, line: { credit: number }) => sum + line.credit, 0);
            
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
              return { error: "Journal entry is unbalanced. Debits must equal credits." };
            }

            // Insert Journal Entry Header (No forced status)
            const { data: entryData, error: entryError } = await supabase.from('JournalEntry').insert({
              companyId,
              date,
              memo,
              createdAt: new Date().toISOString()
            }).select();

            if (entryError) return { error: `Failed to create journal entry header: ${entryError.message}` };

            // Insert Journal Entry Lines
            const linesToInsert = lines.map((line: { accountCode: string; debit: number; credit: number }) => ({
              journalEntryId: entryData[0].id,
              accountCode: line.accountCode,  
              debit: line.debit,
              credit: line.credit
            }));

            const { error: linesError } = await supabase.from('JournalEntryLine').insert(linesToInsert);

            if (linesError) return { error: "Failed to save journal entry lines." };
            
            return { success: true, entryId: entryData[0].id, message: "Journal Entry created successfully. Please review and post it manually." };
          },
        },

        // ✅ TOOL 3: RECORD PAYMENT
        recordPayment: {
          description: 'Record a payment into the database.',
          inputSchema: z.object({ 
            amount: z.number().describe('The payment amount'),
            type: z.enum(['RECEIPT', 'PAYMENT']).describe('Receipt = money in, Payment = money out'),
            method: z.string().describe('Cash, Bank Transfer, etc.'),
            reference: z.string().optional().describe('Invoice number or transaction reference'),
          }),
          execute: async ({ amount, type, method, reference }) => {
            // No forced status. Relies on your DB defaults.
            const { data, error } = await supabase.from('Payment').insert({
              companyId,
              paymentNo: `PAY-${Date.now()}`,
              amount,
              type,
              method,
              reference,
              paymentDate: new Date().toISOString(),
            }).select();

            if (error) return { error: "Failed to record payment." };
            return { success: true, paymentId: data[0].id, message: "Payment recorded successfully." };
          },
        },

        // ✅ TOOL 4: GET CHART OF ACCOUNTS
        getChartOfAccounts: {
          description: 'Fetch the list of accounts to suggest or create a journal entry.',
          inputSchema: z.object({}),
          execute: async () => {
            const { data, error } = await supabase.from('Account')
              .select('code, name, type')
              .eq('companyId', companyId);
            if (error) return { error: "Failed to fetch accounts." };
            return data;
          },
        },

        // ✅ TOOL 5: GET PRODUCTS (For Context)
        getProducts: {
          description: 'Fetch existing products to avoid duplicates or suggest items.',
          inputSchema: z.object({}),
          execute: async () => {
            const { data, error } = await supabase.from('Product')
              .select('id, name, sku, price')
              .eq('companyId', companyId);
            if (error) return { error: "Failed to fetch products." };
            return data;
          },
        }
      },
    });

    return NextResponse.json({ reply: result.text });
    
  } catch (error: any) {
    console.error("❌ AI Error:", error);
    return NextResponse.json({ error: error.message || "Failed to connect to AI" }, { status: 500 });
  }
}