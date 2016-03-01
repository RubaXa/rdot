import TodoApp from './src/app';
import {render} from '../../src/rdot.vdom';

export default function boot(el:HTMLElement):TodoApp {
	const app = new TodoApp();
	render(el, app);
	return app;
}
