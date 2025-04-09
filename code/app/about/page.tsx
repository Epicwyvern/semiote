export default function AboutPage() {
    return (
      <>
        <section className="bg-obsidian-black text-bone-white py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="mb-4">About Semiote</h1>
              <p className="text-lg mb-8">A platform for the analysis, interpretation, and definition of symbols.</p>
            </div>
          </div>
        </section>
  
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h2 className="mb-6">Our Mission</h2>
              <p className="mb-6">
                Semiote is a platform dedicated to the analysis, interpretation, and archiving of symbols from across
                history and cultures. Whether you are an academic looking to get some help with your research, a historian
                looking to gain a deeper insight into cultural and historical motifs, or a creative looking to create your
                own symbols, Semiote should leave users feeling more enlightened about the world of symbols than they were
                before.
              </p>
  
              <h2 className="mb-6 mt-12">Core Values</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl mb-3 text-gold-leaf">Knowledge</h3>
                  <p>
                    We believe in the power of understanding symbols and their meanings across different cultures and time
                    periods.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl mb-3 text-gold-leaf">Discovery</h3>
                  <p>
                    We encourage exploration and the uncovering of new connections between symbols and their
                    interpretations.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl mb-3 text-gold-leaf">Archiving</h3>
                  <p>
                    We are committed to preserving symbolic knowledge for future generations through careful
                    documentation.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl mb-3 text-gold-leaf">Interpretation</h3>
                  <p>We provide tools and resources to help users understand the deeper meanings behind symbols.</p>
                </div>
              </div>
  
              <div className="mt-12 p-8 bg-parchment/30 rounded-lg border border-ash-grey/20">
                <h3 className="text-xl mb-4 text-center font-garamond">Our Approach</h3>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <p className="mb-3">
                      <strong className="text-gold-leaf">Intellectual</strong> but <strong>approachable</strong>
                    </p>
                    <p className="text-ash-grey">
                      We present complex symbolic concepts in an accessible way that doesn't sacrifice depth.
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="mb-3">
                      <strong className="text-gold-leaf">Mystical</strong> but <strong>precise</strong>
                    </p>
                    <p className="text-ash-grey">
                      We honor the mystical aspects of symbols while providing clear, factual information.
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="mb-3">
                      <strong className="text-gold-leaf">Straightforward</strong> but <strong>myriad</strong>
                    </p>
                    <p className="text-ash-grey">
                      We offer direct interpretations while acknowledging the many layers of meaning symbols can have.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </>
    )
  }
  