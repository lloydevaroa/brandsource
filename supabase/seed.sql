-- BRANDSource V1 catalog seed (prices null until PO quotes)
begin;

insert into public.products (slug, name, short_description, unit_price, min_order_qty, sort_order)
values ('table-covers', 'Custom rectangle table covers', 'Fitted, throw or stretch for 6ft / 8ft tables.', null, 1, 0);


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'style', 'Style', 'single', true, 0 from public.products where slug = 'table-covers';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'throw', 'Throw', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'table-covers' and g.key = 'style';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'fitted', 'Fitted', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'table-covers' and g.key = 'style';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'stretch', 'Stretch', 0, 2
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'table-covers' and g.key = 'style';


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'size', 'Size', 'single', true, 1 from public.products where slug = 'table-covers';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, '6ft', '6ft', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'table-covers' and g.key = 'size';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, '8ft', '8ft', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'table-covers' and g.key = 'size';


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'print_sides', 'Print', 'single', true, 2 from public.products where slug = 'table-covers';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'front', 'Front', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'table-covers' and g.key = 'print_sides';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'full-bleed', 'Full bleed', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'table-covers' and g.key = 'print_sides';


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'add_ons', 'Add-ons', 'multi', false, 3 from public.products where slug = 'table-covers';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'carry-bag', 'Carry bag', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'table-covers' and g.key = 'add_ons';


insert into public.products (slug, name, short_description, unit_price, min_order_qty, sort_order)
values ('led-lightbox-bannerstand', 'LED lightbox bannerstand', 'Backlit portable stand, single or double-sided.', null, 1, 1);


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'sides', 'Sides', 'single', true, 0 from public.products where slug = 'led-lightbox-bannerstand';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'single', 'Single-sided', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'led-lightbox-bannerstand' and g.key = 'sides';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'double', 'Double-sided', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'led-lightbox-bannerstand' and g.key = 'sides';


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'add_ons', 'Add-ons', 'multi', false, 1 from public.products where slug = 'led-lightbox-bannerstand';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'spare-graphic', 'Spare graphic', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'led-lightbox-bannerstand' and g.key = 'add_ons';


insert into public.products (slug, name, short_description, unit_price, min_order_qty, sort_order)
values ('feather-teardrop-flags', 'Feather & teardrop flags', 'With cross base or ground spike.', null, 1, 2);


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'style', 'Style', 'single', true, 0 from public.products where slug = 'feather-teardrop-flags';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'feather', 'Feather', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'feather-teardrop-flags' and g.key = 'style';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'teardrop', 'Teardrop', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'feather-teardrop-flags' and g.key = 'style';


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'size', 'Size', 'single', true, 1 from public.products where slug = 'feather-teardrop-flags';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'small', 'Small', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'feather-teardrop-flags' and g.key = 'size';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'medium', 'Medium', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'feather-teardrop-flags' and g.key = 'size';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'large', 'Large', 0, 2
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'feather-teardrop-flags' and g.key = 'size';


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'print_sides', 'Print sides', 'single', true, 2 from public.products where slug = 'feather-teardrop-flags';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'single', 'Single', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'feather-teardrop-flags' and g.key = 'print_sides';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'double', 'Double', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'feather-teardrop-flags' and g.key = 'print_sides';


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'base', 'Base', 'single', true, 3 from public.products where slug = 'feather-teardrop-flags';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'cross-base', 'Cross base', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'feather-teardrop-flags' and g.key = 'base';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'ground-spike', 'Ground spike', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'feather-teardrop-flags' and g.key = 'base';


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'add_ons', 'Add-ons', 'multi', false, 4 from public.products where slug = 'feather-teardrop-flags';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'water-bag', 'Water bag', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'feather-teardrop-flags' and g.key = 'add_ons';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'carry-bag', 'Carry bag', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'feather-teardrop-flags' and g.key = 'add_ons';


insert into public.products (slug, name, short_description, unit_price, min_order_qty, sort_order)
values ('banner-stands', 'Banner stands', 'Roll-up or X-stand, graphic included.', null, 1, 3);


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'style', 'Style', 'single', true, 0 from public.products where slug = 'banner-stands';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'rollup', 'Roll-up', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'banner-stands' and g.key = 'style';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'x-stand', 'X-stand', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'banner-stands' and g.key = 'style';


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'size', 'Size', 'single', true, 1 from public.products where slug = 'banner-stands';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, '850x2000', '850×2000 mm', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'banner-stands' and g.key = 'size';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, '1000x2000', '1000×2000 mm', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'banner-stands' and g.key = 'size';


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'print_sides', 'Print sides', 'single', true, 2 from public.products where slug = 'banner-stands';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'single', 'Single', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'banner-stands' and g.key = 'print_sides';


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'add_ons', 'Add-ons', 'multi', false, 3 from public.products where slug = 'banner-stands';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'carry-bag', 'Carry bag', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'banner-stands' and g.key = 'add_ons';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'spare-graphic', 'Spare graphic', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'banner-stands' and g.key = 'add_ons';


insert into public.products (slug, name, short_description, unit_price, min_order_qty, sort_order)
values ('lanyards', 'Full-colour sublimation lanyards', 'Full-colour or screen print, safety breakaway options.', null, 1, 4);


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'style', 'Style', 'single', true, 0 from public.products where slug = 'lanyards';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'polyester-screen', 'Polyester screen', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'lanyards' and g.key = 'style';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'sublimation-fullcolour', 'Sublimation full-colour', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'lanyards' and g.key = 'style';


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'width', 'Width', 'single', true, 1 from public.products where slug = 'lanyards';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, '20mm', '20 mm', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'lanyards' and g.key = 'width';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, '25mm', '25 mm', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'lanyards' and g.key = 'width';


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'attachment', 'Attachment', 'single', true, 2 from public.products where slug = 'lanyards';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'bulldog', 'Bulldog', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'lanyards' and g.key = 'attachment';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'swivel-hook', 'Swivel hook', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'lanyards' and g.key = 'attachment';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'lobster', 'Lobster', 0, 2
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'lanyards' and g.key = 'attachment';


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'safety', 'Safety', 'single', true, 3 from public.products where slug = 'lanyards';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'standard', 'Standard', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'lanyards' and g.key = 'safety';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'breakaway', 'Breakaway', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'lanyards' and g.key = 'safety';


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'add_ons', 'Add-ons', 'multi', false, 4 from public.products where slug = 'lanyards';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'badge-holder', 'Badge holder', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'lanyards' and g.key = 'add_ons';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'badge-reel', 'Badge reel', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'lanyards' and g.key = 'add_ons';


insert into public.products (slug, name, short_description, unit_price, min_order_qty, sort_order)
values ('custom-buttons', 'Custom buttons', 'Round or square, pin or magnet.', null, 50, 5);


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'shape', 'Shape', 'single', true, 0 from public.products where slug = 'custom-buttons';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'round', 'Round', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'custom-buttons' and g.key = 'shape';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'square', 'Square', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'custom-buttons' and g.key = 'shape';


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'size', 'Size', 'single', true, 1 from public.products where slug = 'custom-buttons';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, '25mm', '25 mm', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'custom-buttons' and g.key = 'size';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, '38mm', '38 mm', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'custom-buttons' and g.key = 'size';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, '50mm', '50 mm', 0, 2
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'custom-buttons' and g.key = 'size';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, '75mm', '75 mm', 0, 3
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'custom-buttons' and g.key = 'size';


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'backing', 'Backing', 'single', true, 2 from public.products where slug = 'custom-buttons';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'pin', 'Pin', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'custom-buttons' and g.key = 'backing';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'magnet', 'Magnet', 0, 1
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'custom-buttons' and g.key = 'backing';


insert into public.products (slug, name, short_description, unit_price, min_order_qty, sort_order)
values ('led-lightbox-counter', 'LED lightbox counter', 'Backlit portable counter for product demos and sampling.', null, 1, 6);


insert into public.option_groups (product_id, key, label, selection, required, sort_order)
select id, 'add_ons', 'Add-ons', 'multi', false, 0 from public.products where slug = 'led-lightbox-counter';


insert into public.option_choices (option_group_id, key, label, price_delta, sort_order)
select g.id, 'spare-graphic', 'Spare graphic', 0, 0
from public.option_groups g
join public.products p on p.id = g.product_id
where p.slug = 'led-lightbox-counter' and g.key = 'add_ons';

commit;