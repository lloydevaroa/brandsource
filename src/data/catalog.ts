export type CatalogProduct = {
  slug: string;
  name: string;
  short_description: string;
  unit_price: number | null;
  min_order_qty: number;
  option_groups: {
    key: string; label: string; selection: "single" | "multi"; required: boolean;
    choices: { key: string; label: string; price_delta: number }[];
  }[];
};

export const catalog: CatalogProduct[] = [
  {
    "slug": "table-covers",
    "name": "Custom rectangle table covers",
    "short_description": "Fitted, throw or stretch for 6ft / 8ft tables.",
    "unit_price": null,
    "min_order_qty": 1,
    "option_groups": [
      {
        "key": "style",
        "label": "Style",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "throw",
            "label": "Throw",
            "price_delta": 0
          },
          {
            "key": "fitted",
            "label": "Fitted",
            "price_delta": 0
          },
          {
            "key": "stretch",
            "label": "Stretch",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "size",
        "label": "Size",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "6ft",
            "label": "6ft",
            "price_delta": 0
          },
          {
            "key": "8ft",
            "label": "8ft",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "print_sides",
        "label": "Print",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "front",
            "label": "Front",
            "price_delta": 0
          },
          {
            "key": "full-bleed",
            "label": "Full bleed",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "add_ons",
        "label": "Add-ons",
        "selection": "multi",
        "required": false,
        "choices": [
          {
            "key": "carry-bag",
            "label": "Carry bag",
            "price_delta": 0
          }
        ]
      }
    ]
  },
  {
    "slug": "vinyl-banners",
    "name": "Custom vinyl banners",
    "short_description": "Matte or gloss, single or double-sided.",
    "unit_price": null,
    "min_order_qty": 1,
    "option_groups": [
      {
        "key": "size",
        "label": "Size",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "600x900",
            "label": "600\u00d7900 mm",
            "price_delta": 0
          },
          {
            "key": "900x1200",
            "label": "900\u00d71200 mm",
            "price_delta": 0
          },
          {
            "key": "1200x1800",
            "label": "1200\u00d71800 mm",
            "price_delta": 0
          },
          {
            "key": "1500x3000",
            "label": "1500\u00d73000 mm",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "print_sides",
        "label": "Print sides",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "single",
            "label": "Single",
            "price_delta": 0
          },
          {
            "key": "double",
            "label": "Double",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "finish",
        "label": "Finish",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "matte",
            "label": "Matte",
            "price_delta": 0
          },
          {
            "key": "gloss",
            "label": "Gloss",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "add_ons",
        "label": "Add-ons",
        "selection": "multi",
        "required": false,
        "choices": [
          {
            "key": "grommets",
            "label": "Grommets",
            "price_delta": 0
          },
          {
            "key": "pole-pockets",
            "label": "Pole pockets",
            "price_delta": 0
          }
        ]
      }
    ]
  },
  {
    "slug": "feather-teardrop-flags",
    "name": "Feather & teardrop flags",
    "short_description": "With cross base or ground spike.",
    "unit_price": null,
    "min_order_qty": 1,
    "option_groups": [
      {
        "key": "style",
        "label": "Style",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "feather",
            "label": "Feather",
            "price_delta": 0
          },
          {
            "key": "teardrop",
            "label": "Teardrop",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "size",
        "label": "Size",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "small",
            "label": "Small",
            "price_delta": 0
          },
          {
            "key": "medium",
            "label": "Medium",
            "price_delta": 0
          },
          {
            "key": "large",
            "label": "Large",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "print_sides",
        "label": "Print sides",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "single",
            "label": "Single",
            "price_delta": 0
          },
          {
            "key": "double",
            "label": "Double",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "base",
        "label": "Base",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "cross-base",
            "label": "Cross base",
            "price_delta": 0
          },
          {
            "key": "ground-spike",
            "label": "Ground spike",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "add_ons",
        "label": "Add-ons",
        "selection": "multi",
        "required": false,
        "choices": [
          {
            "key": "water-bag",
            "label": "Water bag",
            "price_delta": 0
          },
          {
            "key": "carry-bag",
            "label": "Carry bag",
            "price_delta": 0
          }
        ]
      }
    ]
  },
  {
    "slug": "banner-stands",
    "name": "Banner stands",
    "short_description": "Roll-up or X-stand, graphic included.",
    "unit_price": null,
    "min_order_qty": 1,
    "option_groups": [
      {
        "key": "style",
        "label": "Style",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "rollup",
            "label": "Roll-up",
            "price_delta": 0
          },
          {
            "key": "x-stand",
            "label": "X-stand",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "size",
        "label": "Size",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "850x2000",
            "label": "850\u00d72000 mm",
            "price_delta": 0
          },
          {
            "key": "1000x2000",
            "label": "1000\u00d72000 mm",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "print_sides",
        "label": "Print sides",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "single",
            "label": "Single",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "add_ons",
        "label": "Add-ons",
        "selection": "multi",
        "required": false,
        "choices": [
          {
            "key": "carry-bag",
            "label": "Carry bag",
            "price_delta": 0
          },
          {
            "key": "spare-graphic",
            "label": "Spare graphic",
            "price_delta": 0
          }
        ]
      }
    ]
  },
  {
    "slug": "lanyards",
    "name": "Full-colour sublimation lanyards",
    "short_description": "Full-colour or screen print, safety breakaway options.",
    "unit_price": null,
    "min_order_qty": 1,
    "option_groups": [
      {
        "key": "style",
        "label": "Style",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "polyester-screen",
            "label": "Polyester screen",
            "price_delta": 0
          },
          {
            "key": "sublimation-fullcolour",
            "label": "Sublimation full-colour",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "width",
        "label": "Width",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "20mm",
            "label": "20 mm",
            "price_delta": 0
          },
          {
            "key": "25mm",
            "label": "25 mm",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "attachment",
        "label": "Attachment",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "bulldog",
            "label": "Bulldog",
            "price_delta": 0
          },
          {
            "key": "swivel-hook",
            "label": "Swivel hook",
            "price_delta": 0
          },
          {
            "key": "lobster",
            "label": "Lobster",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "safety",
        "label": "Safety",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "standard",
            "label": "Standard",
            "price_delta": 0
          },
          {
            "key": "breakaway",
            "label": "Breakaway",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "add_ons",
        "label": "Add-ons",
        "selection": "multi",
        "required": false,
        "choices": [
          {
            "key": "badge-holder",
            "label": "Badge holder",
            "price_delta": 0
          },
          {
            "key": "badge-reel",
            "label": "Badge reel",
            "price_delta": 0
          }
        ]
      }
    ]
  },
  {
    "slug": "custom-buttons",
    "name": "Custom buttons",
    "short_description": "Round or square, pin or magnet.",
    "unit_price": null,
    "min_order_qty": 50,
    "option_groups": [
      {
        "key": "shape",
        "label": "Shape",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "round",
            "label": "Round",
            "price_delta": 0
          },
          {
            "key": "square",
            "label": "Square",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "size",
        "label": "Size",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "25mm",
            "label": "25 mm",
            "price_delta": 0
          },
          {
            "key": "38mm",
            "label": "38 mm",
            "price_delta": 0
          },
          {
            "key": "50mm",
            "label": "50 mm",
            "price_delta": 0
          },
          {
            "key": "75mm",
            "label": "75 mm",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "backing",
        "label": "Backing",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "pin",
            "label": "Pin",
            "price_delta": 0
          },
          {
            "key": "magnet",
            "label": "Magnet",
            "price_delta": 0
          }
        ]
      }
    ]
  },
  {
    "slug": "popup-banners",
    "name": "Pop-up banners",
    "short_description": "Horizontal or vertical, pack-and-go displays.",
    "unit_price": null,
    "min_order_qty": 1,
    "option_groups": [
      {
        "key": "orientation",
        "label": "Orientation",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "horizontal",
            "label": "Horizontal",
            "price_delta": 0
          },
          {
            "key": "vertical",
            "label": "Vertical",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "size",
        "label": "Size",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "standard",
            "label": "Standard",
            "price_delta": 0
          },
          {
            "key": "large",
            "label": "Large",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "print_sides",
        "label": "Print sides",
        "selection": "single",
        "required": true,
        "choices": [
          {
            "key": "single",
            "label": "Single",
            "price_delta": 0
          },
          {
            "key": "double",
            "label": "Double",
            "price_delta": 0
          }
        ]
      },
      {
        "key": "add_ons",
        "label": "Add-ons",
        "selection": "multi",
        "required": false,
        "choices": [
          {
            "key": "carry-bag",
            "label": "Carry bag",
            "price_delta": 0
          },
          {
            "key": "lights",
            "label": "Lights",
            "price_delta": 0
          }
        ]
      }
    ]
  }
] as const;
