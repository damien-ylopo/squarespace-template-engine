import { Context } from '../context';
import { Node } from '../node';
import { Variable } from '../variable';
import { RootCode } from '../instructions';
import { Formatter, FormatterTable } from '../plugin';
import { MISSING_NODE } from '../node';
import { executeTemplate } from '../exec';
import { isTruthy } from '../util';
import * as commerceutil from './util.commerce';
import { Type } from '../types';

// Template imports
import addToCartBtnTemplate from './templates/add-to-cart-btn.json';
import productCheckoutTemplate from './templates/product-checkout.json';
import variantsSelectTemplate from './templates/variants-select.json';
import summaryFormFieldAddressTemplate from './templates/summary-form-field-address.json';
import summaryFormFieldCheckboxTemplate from './templates/summary-form-field-checkbox.json';
import summaryFormFieldDateTemplate from './templates/summary-form-field-date.json';
import summaryFormFieldLikertTemplate from './templates/summary-form-field-likert.json';
import summaryFormFieldNameTemplate from './templates/summary-form-field-name.json';
import summaryFormFieldPhoneTemplate from './templates/summary-form-field-phone.json';
import summaryFormFieldTimeTemplate from './templates/summary-form-field-time.json';


export class AddToCartButtonFormatter extends Formatter {
  apply(args: string[], vars: Variable[], ctx: Context) {
    const first = vars[0];
    const text = executeTemplate(ctx, addToCartBtnTemplate as unknown as RootCode, first.node, false);
    first.set(text);
  }
}

// TODO: bookkeeper-money-format

export class CartQuantityFormatter extends Formatter {
  apply(args: string[], vars: Variable[], ctx: Context) {
    const first = vars[0];
    let count = 0;
    const entries = first.node.get('entries');
    if (entries.type === Type.ARRAY) {
      for (let i = 0; i < entries.value.length; i++) {
        count += entries.get(i).get('quantity').asNumber();
      }
    }
    const text = `<span class="sqs-cart-quantity">${count}</span>`;
    first.set(text);
  }
}

export class CartSubtotalFormatter extends Formatter {
  apply(args: string[], vars: Variable[], ctx: Context) {
    const first = vars[0];
    const cents = first.node.get('subtotalCents').asNumber();
    // const text = `<span class="sqs-cart-subtotal">`;
    // TODO: writeMoneyString

  }
}

export class CartUrlFormatter extends Formatter {
  apply(args: string[], vars: Variable[], ctx: Context) {
    vars[0].set('/cart');
  }
}

export class FromPriceFormatter extends Formatter {
  apply(args: string[], vars: Variable[], ctx: Context) {
    const first = vars[0];
    const price = commerceutil.getFromPrice(first.node);
    first.set(price);
  }
}

// TODO: MoneyBaseFormatter base class
// TODO: moneyFormat
// TODO: money-format
// TODO: money-string
// TODO: percentage-format

export class NormalPriceFormatter extends Formatter {
  apply(args: string[], vars: Variable[], ctx: Context) {
    const first = vars[0];
    const price = commerceutil.getNormalPrice(first.node);
    first.set(price);
  }
}

export class ProductCheckoutFormatter extends Formatter {
  apply(args: string[], vars: Variable[], ctx: Context) {
    const first = vars[0];
    const text = executeTemplate(ctx, productCheckoutTemplate as unknown as RootCode, first.node, false);
    first.set(text);
  }
}

// TODO: product-price
// TODO: product-quick-view
// TODO: product-status
// TODO: quantity-input

export class SalePriceFormatter extends Formatter {
  apply(args: string[], vars: Variable[], ctx: Context) {
    const first = vars[0];
    const price = commerceutil.getSalePrice(first.node);
    first.set(price);
  }
}

export class VariantDescriptorFormatter extends Formatter {
  apply(args: string[], vars: Variable[], ctx: Context) {
    const first = vars[0];
    const text = commerceutil.getVariantFormat(first.node);
    first.set(text);
  }
}

export class VariantsSelectFormatter extends Formatter {
  apply(args: string[], vars: Variable[], ctx: Context) {
    const first = vars[0];

    const options = commerceutil.getItemVariantOptions(first.node);
    if (options.length === 0) {
      first.set(MISSING_NODE);
      return;
    }

    const node = ctx.newNode({
      item: first.node.value,
      options,
    });

    const text = executeTemplate(ctx, variantsSelectTemplate as unknown as RootCode, node, false);
    first.set(text);
  }
}

const KEY_PREFIX = 'productAnswerMap';
const KEY_STRONGLY_DISAGREE = KEY_PREFIX + 'StronglyDisagree';
const KEY_DISAGREE = KEY_PREFIX + 'Disagree';
const KEY_NEUTRAL = KEY_PREFIX + 'Neutral';
const KEY_AGREE = KEY_PREFIX + 'Agree';
const KEY_STRONGLY_AGREE = KEY_PREFIX + 'StronglyAgree';


const localizeOrDefault = (strings: Node, key: string, defaultValue: string) => {
  const node = strings.get(key);
  return node.type === Type.STRING ? node.value : defaultValue;
};

const buildAnswerMap = (strings: Node) => {
  return {
    '-2': localizeOrDefault(strings, KEY_STRONGLY_DISAGREE, 'Strongly Disagree'),
    '-1': localizeOrDefault(strings, KEY_DISAGREE, 'Disagree'),
    '0': localizeOrDefault(strings, KEY_NEUTRAL, 'Neutral'),
    '1': localizeOrDefault(strings, KEY_AGREE, 'Agree'),
    '2': localizeOrDefault(strings, KEY_STRONGLY_AGREE, 'Strongly Agree'),
  };
};

const convertLikert = (values: any, answerMap: any) => {
  const result = [];
  const keys = Object.keys(values);
  const defaultValue = answerMap['0'];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const answerKey = values[key];
    const value = answerMap[answerKey];
    result.push({ question: key, answer: value || defaultValue });
  }
  return result;
};

const SUMMARY_FORM_FIELD_TEMPLATE_MAP: { [x: string]: RootCode } = {
  address: summaryFormFieldAddressTemplate as unknown as RootCode,
  checkbox: summaryFormFieldCheckboxTemplate as unknown as RootCode,
  date: summaryFormFieldDateTemplate as unknown as RootCode,
  likert: summaryFormFieldLikertTemplate as unknown as RootCode,
  name: summaryFormFieldNameTemplate as unknown as RootCode,
  phone: summaryFormFieldPhoneTemplate as unknown as RootCode,
  time: summaryFormFieldTimeTemplate as unknown as RootCode,
};

export class SummaryFormFieldFormatter extends Formatter {
  apply(args: string[], vars: Variable[], ctx: Context) {
    const first = vars[0];
    const field = first.node;

    const localizedStrings = ctx.resolve(['localizedStrings']);
    const type = field.get('type').asString();
    const code = SUMMARY_FORM_FIELD_TEMPLATE_MAP[type];

    let value = null;
    if (code === undefined) {
      value = field.get('value').asString();
    } else {
      let node = field;
      if (type === 'likert') {
        const answerMap = buildAnswerMap(localizedStrings);
        const likert = convertLikert(field.get('values').value, answerMap);
        node = ctx.newNode(likert);
      }
      value = executeTemplate(ctx, code, node, true);
    }

    let buf = '<div style="font-size:11px; margin-top:3px">\n';


    buf += '  <span style="font-weight:bold;">';
    buf += field.get('rawTitle').asString();
    buf += ':</span> ';
    if (isTruthy(value)) {
      buf += value;
    } else {
      const text = localizedStrings.get('productSummaryFormNoAnswerText').asString().trim();
      buf += text === '' ? 'N/A' : text;
    }
    buf += '\n</div>';
    first.set(buf);
  }
}

export const TABLE: FormatterTable = {
  'add-to-cart-btn': new AddToCartButtonFormatter(),
  'cart-quantity': new CartQuantityFormatter(),
  'cart-subtotal': new CartSubtotalFormatter(),
  'cart-url': new CartUrlFormatter(),
  'from-price': new FromPriceFormatter(),
  'normal-price': new NormalPriceFormatter(),
  'product-checkout': new ProductCheckoutFormatter(),
  'sale-price': new SalePriceFormatter(),
  'summary-form-field': new SummaryFormFieldFormatter(),
  'variant-descriptor': new VariantDescriptorFormatter(),
  'variants-select': new VariantsSelectFormatter(),
};