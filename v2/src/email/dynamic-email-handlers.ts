/**
 * Custom email handlers that read the website port dynamically
 * This allows the email verification links to work even when the dev server port changes
 */
import { EmailEventListener, EmailEventHandler } from '@vendure/email-plugin';
import { AccountRegistrationEvent, PasswordResetEvent, IdentifierChangeRequestEvent, NativeAuthenticationMethod, VendureEvent, RequestContext, Injector, ID } from '@vendure/core';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Custom event for invoice payment requests
 */
export class InvoicePaymentRequestEvent extends VendureEvent {
    constructor(
        public ctx: RequestContext,
        public invoice: {
            id: string;
            token: string;
            name: string;
            description?: string;
            price: number; // in cents
            recipientEmail: string;
            recipientName?: string;
            notes?: string;
            lineItems?: any[];
            expiresAt?: Date;
            seller: {
                id: string;
                businessName?: string;
                firstName: string;
                lastName: string;
            };
        }
    ) {
        super();
    }
}

const IS_DEV = process.env.APP_ENV === 'dev';
const DEV_PORT_FILE = path.join(__dirname, '../../.dev-port');

/**
 * Reads the current website URL dynamically
 * In dev, reads from .dev-port file written by the website dev server
 */
function getWebsiteUrl(): string {
    if (!IS_DEV) {
        return process.env.WEBSITE_URL || 'https://tuner-swap.com';
    }

    // In dev, try to read the dynamic port file
    try {
        if (fs.existsSync(DEV_PORT_FILE)) {
            const port = fs.readFileSync(DEV_PORT_FILE, 'utf-8').trim();
            if (port && !isNaN(parseInt(port))) {
                const url = `http://localhost:${port}`;
                console.log(`[Email] Using dynamic port from file: ${url}`);
                return url;
            }
        }
    } catch (err) {
        console.error('[Email] Error reading port file:', err);
    }

    // Fallback - default to port 4000 which is set in website's package.json dev script
    const fallback = process.env.WEBSITE_URL || 'http://localhost:4000';
    console.log(`[Email] Using URL: ${fallback} (set PORT=4000 in website dev script)`);
    return fallback;
}

/**
 * Email verification handler with dynamic URL
 */
export const dynamicEmailVerificationHandler = new EmailEventListener('email-verification')
    .on(AccountRegistrationEvent)
    .filter(event => {
        const nativeAuthMethod = event.user.authenticationMethods.find(
            m => m instanceof NativeAuthenticationMethod
        ) as NativeAuthenticationMethod | undefined;
        return !!nativeAuthMethod?.identifier;
    })
    .setRecipient(event => event.user.identifier)
    .setFrom('{{ fromAddress }}')
    .setSubject('Please verify your email address')
    .setTemplateVars(event => {
        const websiteUrl = getWebsiteUrl();
        const nativeAuthMethod = event.user.authenticationMethods.find(
            m => m instanceof NativeAuthenticationMethod
        ) as NativeAuthenticationMethod;

        return {
            verificationToken: nativeAuthMethod?.verificationToken,
            verifyEmailAddressUrl: `${websiteUrl}/verify`,
        };
    });

/**
 * Password reset handler with dynamic URL
 */
export const dynamicPasswordResetHandler = new EmailEventListener('password-reset')
    .on(PasswordResetEvent)
    .setRecipient(event => event.user.identifier)
    .setFrom('{{ fromAddress }}')
    .setSubject('Reset your TunerSwap password')
    .setTemplateVars(event => {
        const websiteUrl = getWebsiteUrl();
        const nativeAuthMethod = event.user.authenticationMethods.find(
            m => m instanceof NativeAuthenticationMethod
        ) as NativeAuthenticationMethod;

        return {
            passwordResetToken: nativeAuthMethod?.passwordResetToken,
            passwordResetUrl: `${websiteUrl}/password-reset`,
        };
    });

/**
 * Email address change handler with dynamic URL
 */
export const dynamicEmailAddressChangeHandler = new EmailEventListener('email-address-change')
    .on(IdentifierChangeRequestEvent)
    .setRecipient(event => {
        const nativeAuthMethod = event.user.authenticationMethods.find(
            m => m instanceof NativeAuthenticationMethod
        ) as NativeAuthenticationMethod;
        return nativeAuthMethod?.pendingIdentifier || event.user.identifier;
    })
    .setFrom('{{ fromAddress }}')
    .setSubject('Verify your new email address')
    .setTemplateVars(event => {
        const websiteUrl = getWebsiteUrl();
        const nativeAuthMethod = event.user.authenticationMethods.find(
            m => m instanceof NativeAuthenticationMethod
        ) as NativeAuthenticationMethod;

        return {
            identifierChangeToken: nativeAuthMethod?.identifierChangeToken,
            changeEmailAddressUrl: `${websiteUrl}/verify-email-address-change`,
        };
    });

/**
 * Invoice payment request email handler
 */
export const invoicePaymentRequestHandler = new EmailEventListener('invoice-payment')
    .on(InvoicePaymentRequestEvent)
    .setRecipient(event => event.invoice.recipientEmail)
    .setFrom('{{ fromAddress }}')
    .setSubject('Invoice from {{ sellerName }}: {{ invoiceName }}')
    .setTemplateVars(event => {
        const websiteUrl = getWebsiteUrl();
        const invoice = event.invoice;
        const seller = invoice.seller;
        const sellerName = seller.businessName || `${seller.firstName} ${seller.lastName}`;

        // Format price as currency
        const formatPrice = (cents: number) => {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
            }).format(cents / 100);
        };

        // Format line items if present
        let formattedLineItems: any[] = [];
        if (invoice.lineItems && invoice.lineItems.length > 0) {
            formattedLineItems = invoice.lineItems.map(item => ({
                ...item,
                formattedPrice: formatPrice(item.quantity * item.unitPrice * 100),
            }));
        }

        // Format expiration date
        const formattedExpiry = invoice.expiresAt
            ? new Date(invoice.expiresAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            })
            : null;

        return {
            invoiceName: invoice.name,
            description: invoice.description,
            totalAmount: formatPrice(invoice.price),
            sellerName,
            sellerId: seller.id,
            recipientEmail: invoice.recipientEmail,
            recipientName: invoice.recipientName,
            notes: invoice.notes,
            lineItems: formattedLineItems.length > 0 ? formattedLineItems : null,
            expiresAt: formattedExpiry,
            invoiceDate: new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            }),
            paymentUrl: `${websiteUrl}/pay/${invoice.token}`,
        };
    });

/**
 * All dynamic email handlers
 * Note: Order confirmation is not included - it doesn't need dynamic URLs
 */
export const dynamicEmailHandlers = [
    dynamicEmailVerificationHandler,
    dynamicPasswordResetHandler,
    dynamicEmailAddressChangeHandler,
    invoicePaymentRequestHandler,
];
