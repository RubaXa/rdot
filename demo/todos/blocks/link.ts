import {reactive} from '../../../src/rdecorators';

interface LinkProps {
	to:string;
	selected:boolean;
	text:string;
}

export default class Link {
	static template:string = `<a
		href="{this.to}"
		class="{this.selected ? 'selected' : ''}"
	>{this.text}</a>`;

	@reactive public to:string;
	@reactive public selected:boolean;
	@reactive public text:string;
}
