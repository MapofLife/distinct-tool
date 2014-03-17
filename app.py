from google.appengine.ext.webapp import template
from google.appengine.ext.webapp.util import run_wsgi_app

import logging
import os
import random
import webapp2

if 'SERVER_SOFTWARE' in os.environ:
    PROD = not os.environ['SERVER_SOFTWARE'].startswith('Development')
else:
    PROD = True

class BaseHandler(webapp2.RequestHandler):
    def render_template(self, f, template_args):
        path = os.path.join(os.path.dirname(__file__), "server_templates", f)
        self.response.out.write(template.render(path, template_args))

    def push_html(self, f):
        path = os.path.join(os.path.dirname(__file__), "server_templates", f)
        self.response.out.write(open(path, 'r').read())

class RefineTool(BaseHandler):
    def get(self):
        self.push_html('refine-template.html')
    def post(self):
        self.push_html('refine-template.html')

application = webapp2.WSGIApplication(
         [('/', RefineTool), ('/.*',RefineTool)],
         debug=True)

def main():
    run_wsgi_app(application)

if __name__ == "__main__":
    main()
